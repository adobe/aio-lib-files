/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* global AzureCredentials  */ // for linter

const azure = require('@azure/storage-blob')
const joi = require('joi')
const stream = require('stream')
const mime = require('mime-types')
const fetch = require('node-fetch')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const xmlJS = require('xml-js')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

const utils = require('../utils')
const { Files, FilePermissions, UrlType } = require('../Files')
const { codes, logAndThrow } = require('../FilesError')

require('../types.jsdoc') // for VS Code autocomplete

const STREAM_BUFFER_SIZE = 4 * 1024 * 1024 // 4 MB
const STREAM_MAX_CONCURRENCY = 10
const AZURE_STORAGE_DOMAIN = 'blob.core.windows.net'
const DEFAULT_CDN_STORAGE_HOST = 'firefly.azureedge.net'
const STAGE_CDN_STORAGE_HOST = 'firefly-stage.azureedge.net'
const PUBLIC_CONTAINER_SUFFIX = '-public'

const {
  getCliEnv, /* function */
  STAGE_ENV /* string */
} = require('@adobe/aio-lib-env')

// todo move somewhere else
// eslint-disable-next-line jsdoc/require-jsdoc
function lookupMimeType (filePath) {
  return mime.lookup(filePath) || 'application/octet-stream'
}

/**
 * @class AzureBlobFiles
 * @classdesc Cloud Files Implementation on top of Azure Blob
 * @augments Files
 * @hideconstructor
 * @private
 */
class AzureBlobFiles extends Files {
  /**
   * [INTERNAL] Creates an instance of AzureBlobFiles. Use static init instead.
   *
   * @param {AzureCredentials} credentials {@link AzureCredentials}
   * @param {object} tvm TVM Client instance
   * @memberof AzureBlobFiles
   * @private
   */
  constructor (credentials = {}, tvm = null) {
    super()
    /** @private */
    this.tvm = tvm
    /** @private */
    this.hasOwnCredentials = (tvm === null)
    const cloned = utils.withHiddenFields(credentials, ['storageAccessKey', 'sasURLPrivate', 'sasURLPublic'])
    logger.debug(`init AzureBlobFiles with config ${JSON.stringify(cloned, null, 2)}`)

    const res = joi.object().label('credentials').keys({
      // either
      sasURLPrivate: joi.string().uri(),
      sasURLPublic: joi.string().uri(),
      // or
      storageAccessKey: joi.string(),
      storageAccount: joi.string(),
      containerName: joi.string()
    }).required().unknown()
      .and('storageAccount', 'storageAccessKey', 'containerName')
      .and('sasURLPrivate', 'sasURLPublic')
      .xor('sasURLPrivate', 'storageAccount')
      .validate(credentials)
    if (res.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({ messageValues: [res.error.message], sdkDetails: cloned }))
    }

    /** @private */
    this._azure = {}
    /** @private */
    this.credentials = utils.clone(credentials)

    const env = getCliEnv()
    /** @private */
    this.defaultHostName = env === STAGE_ENV ? STAGE_CDN_STORAGE_HOST : DEFAULT_CDN_STORAGE_HOST

    /**
     * @private
     * @type {azure.ContainerClient}
     **/
    this.containerClientPrivate = null
    /**
     * @private
     * @type {azure.ContainerClient}
     **/
    this.containerClientPublic = null
    /** @private */
    this.usesSASCreds = null

    if (credentials.sasURLPrivate) {
      this._initWithNewCreds(credentials)
      this.usesSASCreds = true
    } else {
      const azureCreds = new azure.StorageSharedKeyCredential(credentials.storageAccount, credentials.storageAccessKey)
      const blobServiceClient = new azure.BlobServiceClient(`https://${credentials.storageAccount}.${AZURE_STORAGE_DOMAIN}/`, azureCreds)
      this.containerClientPrivate = blobServiceClient.getContainerClient(credentials.containerName)
      this.containerClientPublic = blobServiceClient.getContainerClient(credentials.containerName + PUBLIC_CONTAINER_SUFFIX)
      this.usesSASCreds = false
    }
  }

  /**
   * Creates and return an instance of AzureBlobFiles. Also creates needed azure
   * containers if credentials are not SAS
   *
   * @static
   * @param {AzureCredentials} credentials {@link AzureCredentials}
   * @param {object} tvm TVM Client instance
   * @returns {Promise<AzureBlobFiles>} new instance
   * @memberof AzureBlobFiles
   */
  static async init (credentials, tvm) {
    const azureFiles = new AzureBlobFiles(credentials, tvm)

    // container sas creds are not allowed to create containers and so those
    // credentials must point to already existing containers

    if (!azureFiles.usesSASCreds) {
      logger.debug('using azure storage account credentials')
      // for the non sasCreds case we can make sure those containers exists
      await azureFiles._wrapProviderRequest(
        azureFiles.containerClientPrivate.createIfNotExists(),
        { containerName: credentials.containerName, storageAccount: credentials.storageAccount }
      )
      await azureFiles._wrapProviderRequest(
        azureFiles.containerClientPublic.createIfNotExists({ access: 'blob' }),
        { containerName: credentials.containerName + PUBLIC_CONTAINER_SUFFIX, storageAccount: credentials.storageAccount }
      )

      // TODO !!!! => no need for the sign logic anymore
      await azureFiles._addAccessPolicyIfNotExists()
      return azureFiles
    }
    logger.debug('using azure SAS credentials')
    return azureFiles
  }

  /* **************************** PRIVATE HELPERS ***************************** */

  /**
   * @typedef AzureProps
   * @type {object}
   * @property {azure.ContainerClient} containerClient private or public Azure blob container
   * @property {azure.BlockBlobClient} blockBlobClient the azure blockBlobClient
   * @private
   */

  /**
   * [Internal] Parses the input path to determine if it is public or private
   * then returns an internal property object that can be used to access the file
   *
   * @param {RemotePathString} filePath {RemotePathString}
   * @returns {AzureProps} object containing azure resources for the specified path
   *
   * @private
   * @memberof AzureBlobFiles
   */
  _propsForPath (filePath) {
    // this fails with empty string, so set to '/'
    const usePath = filePath || '/'
    const azureProps = {}
    if (Files._isRemotePublic(usePath)) {
      azureProps.containerClient = this.containerClientPublic
    } else {
      azureProps.containerClient = this.containerClientPrivate
    }
    azureProps.blockBlobClient = azureProps.containerClient.getBlockBlobClient(usePath)
    return azureProps
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _initWithNewCreds (creds) {
    let credentials = creds
    // get credentails if not passed
    if (!credentials && !this.hasOwnCredentials) {
      // use TVM Client to get credentials, this will refresh token if it was expired
      credentials = await utils.wrapTVMRequest(this.tvm.getAzureBlobCredentials())
    }

    if (credentials || !this.hasOwnCredentials) {
      // this seems like an error, if we get here without credentials this will throw
      // when we access credentials.sasURLPrivate, should this be an && instead of || ?
      const azureCreds = new azure.AnonymousCredential()
      const pipeline = azure.newPipeline(azureCreds)
      const privateUrl = new URL(credentials.sasURLPrivate)
      privateUrl.host = DEFAULT_CDN_STORAGE_HOST
      const publicUrl = new URL(credentials.sasURLPublic)
      publicUrl.host = DEFAULT_CDN_STORAGE_HOST

      this.containerClientPrivate = new azure.ContainerClient(privateUrl.toString(), pipeline)
      this.containerClientPublic = new azure.ContainerClient(publicUrl.toString(), pipeline)
    }
  }

  /** [Internal] Set empty access policy
   * @memberof AzureBlobFiles
   * @private
   */
  async _setAccessPolicies () {
    const id = uuidv4()
    // set access policy with new id and without any permissions
    await this.containerClientPrivate.setAccessPolicy(undefined, [{ id, accessPolicy: { permission: '' } }])
    await this.containerClientPublic.setAccessPolicy('blob', [{ id, accessPolicy: { permission: '' } }])
  }

  /** [Internal] get Access policy IDs
   * @memberof AzureBlobFiles
   * @returns {{publicAccessPolicyId, privateAccessPolicyId}} array of access policy IDs
   * @private
   */
  async _getAccessPolicyIdentifiers () {
    return {
      privateAccessPolicyId: await _getAccessPolicyID(
        this.credentials.storageAccount,
        this.credentials.storageAccessKey,
        this.containerClientPrivate
      ),
      publicAccessPolicyId: await _getAccessPolicyID(
        this.credentials.storageAccount,
        this.credentials.storageAccessKey,
        this.containerClientPublic
      )
    }
  }

  /**
   * [Internal] Adds a default access policy if none exists
   *
   * @private
   */
  async _addAccessPolicyIfNotExists () {
    const pols = await this._getAccessPolicyIdentifiers()
    if (pols.privateAccessPolicyId && pols.publicAccessPolicyId) {
      logger.debug(`found access policies ${JSON.stringify(pols)}`)
      if (this.hasOwnCredentials) {
        // check if identifier is custom or not
        if (this._isCustomPolicy(pols.privateAccessPolicyId) || this._isCustomPolicy(pols.publicAccessPolicyId)) {
          const msg = 'Custom access policies are defined. Please remove all access policies or use another container.'
          logAndThrow(new codes.ERROR_INIT_FAILURE({ messageValues: [msg], sdkDetails: {} }))
        }
      }
    } else {
      logger.debug('adding default access policy')
      await this._setAccessPolicies() // reset both policies
    }
  }

  /**
   * [Internal] Check if identifier is custom or not
   *
   * @private
   */
  _isCustomPolicy (identifier) {
    // if its uuidv4 type of identifier then consider it as non custom, this is to support any already created policies by aio-lib-flies
    const testUUIDv4 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi
    return !(testUUIDv4.test(identifier))
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async getFileInfo (filePath) {
    Files._throwIfRemoteDirectory(filePath)
    const azureProps = this._propsForPath(filePath)
    // Note: this throws on 404
    const blobProps = await this._wrapProviderRequest(
      azureProps.blockBlobClient.getProperties(),
      { filePath },
      filePath
    )
    const blobDesc = {
      name: filePath,
      creationTime: blobProps.createdOn,
      lastModified: blobProps.lastModified,
      etag: blobProps.etag,
      contentLength: blobProps.contentLength,
      contentType: blobProps.contentType,
      isDirectory: Files._isRemoteDirectory(filePath),
      isPublic: Files._isRemotePublic(filePath),
      url: this._getUrl(filePath),
      internalUrl: this._getUrl(filePath, UrlType.internal)
    }
    return blobDesc
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _listFolder (filePath) {
    const __listFolder = async (_filePath, /** @type {AzureProps} */azureProps) => {
      const elements = []
      const iterator = azureProps.containerClient.listBlobsFlat({ prefix: _filePath }).byPage({ maxPageSize: 1000 })
      const response = (await iterator.next()).value
      for (const item of response.segment.blobItems) {
        elements.push({
          name: item.name,
          creationTime: item.properties.createdOn,
          lastModified: item.properties.lastModified,
          etag: item.properties.etag,
          contentLength: item.properties.contentLength,
          contentType: item.properties.contentType,
          isDirectory: Files._isRemoteDirectory(item.name),
          isPublic: Files._isRemotePublic(item.name),
          url: this._getUrl(item.name),
          internalUrl: this._getUrl(item.name, UrlType.internal)
        })
      }
      return elements
    }

    const azureProps = this._propsForPath(filePath)
    // case 1 we list the root => need to list both public and private containers
    if (Files._isRemoteRoot(filePath)) {
      const res = await Promise.all([
        __listFolder(filePath, azureProps),
        __listFolder(Files.publicPrefix,
          this._propsForPath(Files.publicPrefix))])
      return res[0].concat(res[1])
    }
    // case 2 we list a non root folder => only list one container
    return __listFolder(filePath, azureProps)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _fileExists (filePath) {
    const azureProps = this._propsForPath(filePath)
    // wrapProviderRequest returns null on 404, see _wrapProviderRequest
    const blobProps = await this._wrapProviderRequest(azureProps.blockBlobClient.getProperties(), { filePath })
    return !!blobProps
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _deleteFile (file) {
    const filePath = file.name || file
    const azureProps = this._propsForPath(filePath)
    await this._wrapProviderRequest(azureProps.blockBlobClient.delete(), { filePath }, filePath)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _createReadStream (filePath, options) {
    const azureProps = this._propsForPath(filePath)
    return (await this._wrapProviderRequest(azureProps.blockBlobClient.download(options.position, options.length), { filePath, options }, filePath)).readableStreamBody
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _createWriteStream (filePath) {
    // NOTE: this is an experimental method

    const emitErrorIfPromiseRejects = (azureBlobWriteStream) => {
      azureBlobWriteStream._promise.catch(e => { azureBlobWriteStream.emit('error', e) })
    }
    // Azure does not seem to support creating write streams OOTB
    // this is a hack using PassThrough streams
    const AzureBlobWriteStream = class AzureBlobWriteStream extends stream.PassThrough {
      constructor (azureProps, wrapProviderRequest) {
        super()
        this.bytesWritten = 0
        this.on('data', chunk => { this.bytesWritten += chunk.length })
        this._promise = wrapProviderRequest(
          azureProps.blockBlobClient.uploadStream(
            // here is the trick, uploadStream will start reading from this while the user
            // writes to this stream, this works because this class extends PassThrough
            this,
            STREAM_BUFFER_SIZE,
            STREAM_MAX_CONCURRENCY,
            { blobHTTPHeaders: { blobContentType: lookupMimeType(filePath) } }
          ),
          { filePath },
          filePath
        ).then(_ => this.bytesWritten)
      }

      // emit an error only if user tries to writes something
      _write (chunk, enc, cb) {
        emitErrorIfPromiseRejects(this)
        super._write(chunk, enc, cb)
      }

      /* istanbul ignore next */
      _writev (chunks, cb) {
        emitErrorIfPromiseRejects(this)
        super._writev(chunks, cb)
      }

      emit (event, ...args) {
        // stale the finish event until the data got written
        if (event === 'finish') {
          this._promise.then(res => super.emit(event, res, ...args))
        } else {
          super.emit(event, ...args)
        }
      }
    }
    return new AzureBlobWriteStream(this._propsForPath(filePath), this._wrapProviderRequest.bind(this))
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _writeStream (filePath, content) {
    const azureProps = this._propsForPath(filePath)
    const uploadOptions = { blobHTTPHeaders: { blobContentType: lookupMimeType(filePath) } }
    let length = 0
    // we know that dependency will wait until end event, so we can simply plug
    // to data event.
    content.on('data', chunk => { length += chunk.length })
    await this._wrapProviderRequest(
      // there is potential for perf improvements here, more in the azure docs
      azureProps.blockBlobClient.uploadStream(
        content,
        STREAM_BUFFER_SIZE,
        STREAM_MAX_CONCURRENCY,
        uploadOptions
      ),
      // error details with content type instead of content in case of error
      { filePath, contentType: 'Readable' }, filePath)
    return length
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _writeBuffer (filePath, content) {
    const azureProps = this._propsForPath(filePath)
    const uploadOptions = { blobHTTPHeaders: { blobContentType: lookupMimeType(filePath) } }
    // think about it: supports on upload progress callback
    await this._wrapProviderRequest(azureProps.blockBlobClient.upload(content, content.length, uploadOptions), { filePath, contentType: 'Buffer' }, filePath)
    return content.length
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _copyRemoteToRemoteFile (srcPath, destPath) {
    const destProps = this._propsForPath(destPath)
    await this._wrapProviderRequest(destProps.blockBlobClient.startCopyFromURL(this._propsForPath(srcPath).blockBlobClient.url), { srcPath, destPath }, srcPath)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  _getUrl (filePath, urlType = UrlType.external) {
    // this kindof does the opposite now
    // ie. azureURL was always an internal url, and we returned a modified version for external
    // now azureURL is always external, and we return a modified version for internal
    const azureURL = this._propsForPath(filePath).blockBlobClient.url.split('?')[0]
    let hostNameToUse = this.defaultHostName

    if (urlType === UrlType.internal) {
      hostNameToUse = `${this.credentials.storageAccount}.${AZURE_STORAGE_DOMAIN}`
    }

    if (this.hasOwnCredentials && this.credentials.hostName) {
      hostNameToUse = this.credentials.hostName
    }
    const url = new URL(azureURL)
    url.protocol = 'https:'
    url.host = hostNameToUse
    return url.toString()
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _getPresignUrl (filePath, options) {
    if (!options || !options.expiryInSeconds) {
      logAndThrow(new codes.ERROR_MISSING_OPTION({ messageValues: ['expiryInSeconds'], sdkDetails: [filePath, options] }))
    }

    if (!options.permissions) {
      options.permissions = FilePermissions.READ
    }

    const urlType = options.urlType
    delete options.urlType // remove extra key for presign options

    const presignOptions = Object.assign({ blobName: filePath }, options)

    let cred
    if (this.hasOwnCredentials) {
      // generate signature based on options and using own credentials
      cred = await this._getAzureBlobPresignCredentials(presignOptions)
    } else {
      cred = await utils.wrapTVMRequest(this.tvm.getAzureBlobPresignCredentials(presignOptions))
    }

    return this._getUrl(filePath, urlType) + '?' + cred.signature
  }

  /**
   * @memberof AzureBlobFiles
   * @private
   */
  async _getAzureBlobPresignCredentials (params) {
    if (this.usesSASCreds) {
      const msg = 'generatePresignURL is not supported with Azure Container SAS credentials, please initialize the SDK with Azure storage account credentials instead'
      logAndThrow(new codes.ERROR_UNSUPPORTED_OPERATION({ messageValues: [msg], sdkDetails: params }))
    }

    const sharedKeyCredential = new azure.StorageSharedKeyCredential(this.credentials.storageAccount, this.credentials.storageAccessKey)

    let containerName = this.credentials.containerName
    let publicAccess = false
    if (params.blobName.startsWith('public/')) {
      // public blobs are stored on the public container
      containerName = containerName + '-public'
      publicAccess = true
    }

    // generate SAS token
    const expiryTime = new Date(Date.now() + (1000 * params.expiryInSeconds))

    const { privateAccessPolicyId, publicAccessPolicyId } = await this._getAccessPolicyIdentifiers()
    const permissions = azure.BlobSASPermissions.parse(params.permissions)
    const commonSasParams = {
      permissions: permissions.toString(),
      expiresOn: expiryTime,
      blobName: params.blobName,
      identifier: publicAccess ? publicAccessPolicyId : privateAccessPolicyId
    }

    const sasQueryParamsPrivate = azure.generateBlobSASQueryParameters({ ...commonSasParams, containerName }, sharedKeyCredential)
    return {
      signature: sasQueryParamsPrivate.toString()
    }
  }

  /**
   * @memberof AzureBlobFiles
   * @private
   */
  async _revokePresignURLs () {
    if (this.usesSASCreds) {
      const msg = 'revokeAllPresignURLs is not supported with Azure Container SAS credentials, please initialize the SDK with Azure storage account credentials instead'
      logAndThrow(new codes.ERROR_UNSUPPORTED_OPERATION({ messageValues: [msg], sdkDetails: {} }))
    }
    await this._setAccessPolicies()
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _revokeAllPresignURLs () {
    if (this.hasOwnCredentials) {
      // revoke signature using own credentials
      await this._revokePresignURLs()
    } else {
      await utils.wrapTVMRequest(this.tvm.revokePresignURLs())
    }
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  _statusFromProviderError (e) {
    return e.response && e.response.status
  }
}

/** [Internal] get Access policy ID
   * @memberof AzureBlobFiles
   * @param {string} storageAccount azure storage account name
   * @param {string} storageAccessKey azure storage access key
   * @param {azure.ContainerClient} containerClient container client
   * @returns {string} access policy ID
   * @private
   */
async function _getAccessPolicyID (storageAccount, storageAccessKey, containerClient) {
  // use API call as containerClient.getAccessPolicy calls fails for policy with empty permissions
  const index = containerClient.url.lastIndexOf('/')
  const containerName = containerClient.url.substring(index + 1, containerClient.url.length)

  const resource = '/' + storageAccount + '/' + containerName + '\ncomp:acl\nrestype:container'
  const date = new Date().toUTCString()
  const sign = _signRequest('GET', resource, date, storageAccessKey)

  const reqHeaders = {
    'x-ms-date': date,
    'x-ms-version': '2019-02-02',
    authorization: 'SharedKey ' + storageAccount + ':' + sign
  }
  const url = containerClient.url + '?restype=container&comp=acl'
  const res = await fetch(url, { method: 'GET', headers: reqHeaders })

  const acl = await res.text()
  const aclObj = xmlJS.xml2js(acl)
  let id
  if (aclObj.elements) {
    const signedIdentifiers = aclObj.elements[0]
    if (signedIdentifiers.elements) {
      if (signedIdentifiers.elements.length > 1) {
        const msg = 'Container has more than one access policies defined. Please remove all custom access policies or use another container.'
        logAndThrow(new codes.ERROR_INIT_FAILURE({ messageValues: [msg], sdkDetails: {} }))
      }
      const signedIdentifier = signedIdentifiers.elements[0].elements

      signedIdentifier.forEach(function (val, index, arr) {
        if (val.name === 'Id') {
          id = val.elements[0].text
          return id
        }
      })
    }
  }
  return id
}

/** [Internal] Sign the given request
 * @memberof AzureBlobFiles
 * @private
 */
function _signRequest (method, resource, date, storageAccessKey) {
  const canonicalHeaders = 'x-ms-date:' + date + '\n' + 'x-ms-version:2019-02-02'
  const stringToSign = method + '\n\n\n\n\n\n\n\n\n\n\n\n' + canonicalHeaders + '\n' + resource
  return crypto.createHmac('sha256', Buffer.from(storageAccessKey, 'base64')).update(stringToSign, 'utf8').digest('base64')
}

module.exports = { AzureBlobFiles }
