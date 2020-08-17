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

const azure = require('@azure/storage-blob')
const joi = require('@hapi/joi')
const stream = require('stream')
const mime = require('mime-types')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

const utils = require('../utils')
const { Files } = require('../Files')
const { codes, logAndThrow } = require('../FilesError')

require('../types.jsdoc') // for VS Code autocomplete
/* global AzureCredentials, AzureProps, RemotePathString */ // for linter

const STREAM_BLOCK_SIZE = 2 * 1024 * 1024
const STREAM_MAX_BUFFERS = 20
const AZURE_STORAGE_DOMAIN = 'blob.core.windows.net'
const DEFAULT_CDN_STORAGE_HOST = 'firefly.azureedge.net'

/**
 * Creates a container if it does not exist
 *
 * @param {azure.ContainerURL} containerURL azure ContainerUrl
 * @param {azure.Aborter} aborter azure Aborter
 * @param {boolean} [isPublic=false] set to true to create a public container
 * @private
 */
async function createContainerIfNotExists (containerURL, aborter, isPublic = false) {
  try {
    logger.debug(`creating ${isPublic ? 'public' : 'private'} azure blob container`)
    await containerURL.create(aborter, isPublic ? { access: 'blob' } : {})
  } catch (e) {
    // bug in the past where randomly switch from Code to code.. weird
    if (!(typeof e.body === 'object' && (e.body.Code === 'ContainerAlreadyExists' || e.body.code === 'ContainerAlreadyExists'))) throw e
    logger.debug(`${isPublic ? 'public' : 'private'} azure blob container already exists`)
  }
}

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
  constructor (credentials, tvm) {
    super()
    this.tvm = tvm
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
    }).required().unknown().and('storageAccount', 'storageAccessKey', 'containerName').and('sasURLPrivate', 'sasURLPublic').xor('sasURLPrivate', 'storageAccount')
      .validate(credentials)
    if (res.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({ messageValues: [res.error.message], sdkDetails: cloned }))
    }

    // todo parse containerName for invalid chars

    /** @private */
    this._azure = {}
    this._azure.aborter = azure.Aborter.none
    if (credentials.sasURLPrivate) {
      const azureCreds = new azure.AnonymousCredential()
      const pipeline = azure.StorageURL.newPipeline(azureCreds)
      this._azure.containerURLPrivate = new azure.ContainerURL(credentials.sasURLPrivate, pipeline)
      this._azure.containerURLPublic = new azure.ContainerURL(credentials.sasURLPublic, pipeline)
      this._azure.sasCreds = true
    } else {
      const azureCreds = new azure.SharedKeyCredential(credentials.storageAccount, credentials.storageAccessKey)
      const pipeline = azure.StorageURL.newPipeline(azureCreds)
      const serviceURL = new azure.ServiceURL(`https://${credentials.storageAccount}.blob.core.windows.net/`, pipeline)
      this._azure.containerURLPrivate = azure.ContainerURL.fromServiceURL(serviceURL, credentials.containerName + '')
      this._azure.containerURLPublic = azure.ContainerURL.fromServiceURL(serviceURL, credentials.containerName + '-public')
      this._azure.sasCreds = false
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

    // todo don't do those requests for perf reasons?
    // container sas creds are not allowed to create containers and so those
    // credentials must point to already existing containers
    if (!azureFiles._azure.sasCreds) {
      logger.debug('using azure storage account credentials')
      // for the non sasCreds case we can make sure those containers exists
      const errorDetails = { containerName: credentials.containerName, storageAccount: credentials.storageAccount }
      await azureFiles._wrapProviderRequest(createContainerIfNotExists(azureFiles._azure.containerURLPrivate, azureFiles._azure.aborter), errorDetails)
      await azureFiles._wrapProviderRequest(createContainerIfNotExists(azureFiles._azure.containerURLPublic, azureFiles._azure.aborter, true), errorDetails)
      return azureFiles
    }
    logger.debug('using azure SAS credentials')
    return azureFiles
  }

  /* **************************** PRIVATE HELPERS ***************************** */

  /**
   * @typedef AzureProps
   * @type {object}
   * @property {azure.ContainerURL} containerURL private or public Azure blob container
   * @property {azure.BlockBlobURL} blockBlobURL the azure blockBlobURL
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
    const azureProps = {}

    if (Files._isRemotePublic(filePath)) {
      azureProps.containerURL = this._azure.containerURLPublic
    } else {
      azureProps.containerURL = this._azure.containerURLPrivate
    }
    azureProps.blockBlobURL = azure.BlockBlobURL.fromContainerURL(azureProps.containerURL, filePath)

    return azureProps
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */
  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _listFolder (filePath) {
    const __listFolder = async (_filePath, azureProps) => {
      let elements = []
      let marker
      do {
        const options = { delimiter: '/' }
        // prefix='' works with SAS credentials but breaks with
        // storageAccount credentials => bug in azure?
        if (_filePath !== '') options.prefix = _filePath
        const response = await this._wrapProviderRequest(azureProps.containerURL.listBlobFlatSegment(this._azure.aborter, marker, options), { filePath: _filePath })
        marker = response.marker
        elements = elements.concat(response.segment.blobItems.map(blob => blob.name))
      } while (marker)
      return elements
    }

    const azureProps = this._propsForPath(filePath)
    // case 1 we list the root => need to list both public and private containers
    if (Files._isRemoteRoot(filePath)) {
      const res = await Promise.all([__listFolder(filePath, azureProps), __listFolder(Files.publicPrefix, this._propsForPath(Files.publicPrefix))])
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
    // wrapProviderRequest returns null on 404
    const blobProps = await this._wrapProviderRequest(azureProps.blockBlobURL.getProperties(this._azure.aborter), { filePath })
    return !!blobProps
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _deleteFile (filePath) {
    const azureProps = this._propsForPath(filePath)
    await this._wrapProviderRequest(azureProps.blockBlobURL.delete(this._azure.aborter), { filePath }, filePath)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _createReadStream (filePath, options) {
    const azureProps = this._propsForPath(filePath)
    return (await this._wrapProviderRequest(azureProps.blockBlobURL.download(this._azure.aborter, options.position, options.length), { filePath, options }, filePath)).readableStreamBody
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _createWriteStream (filePath) {
    const emitErrorIfPromiseRejects = (azureBlobWriteStream) => {
      azureBlobWriteStream._promise.catch(e => { azureBlobWriteStream.emit('error', e) })
    }
    // Azure does not seem to support write streams OOTB for now
    // this is a hack using PassThrough streams
    const AzureBlobWriteStream = class AzureBlobWriteStream extends stream.PassThrough {
      constructor (azureProps, azureAborter, wrapProviderRequest) {
        super()
        this.bytesWritten = 0
        this.on('data', chunk => { this.bytesWritten += chunk.length })
        this._promise = wrapProviderRequest(azure.uploadStreamToBlockBlob(
          azureAborter,
          this,
          azureProps.blockBlobURL,
          STREAM_BLOCK_SIZE,
          STREAM_MAX_BUFFERS,
          { blobHTTPHeaders: { blobContentType: lookupMimeType(filePath) } }
        ), { filePath }, filePath).then(_ => this.bytesWritten)
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
        if (event === 'finish') this._promise.then(res => super.emit(event, res, ...args))
        else super.emit(event, ...args)
      }
    }
    return new AzureBlobWriteStream(this._propsForPath(filePath), this._azure.aborter, this._wrapProviderRequest.bind(this))
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
    await this._wrapProviderRequest(azure.uploadStreamToBlockBlob(
      this._azure.aborter,
      content,
      azureProps.blockBlobURL,
      STREAM_BLOCK_SIZE,
      STREAM_MAX_BUFFERS,
      uploadOptions
    ), { filePath, contentType: 'Readable' }, filePath) // error details with content type instead of content in case of error
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
    await this._wrapProviderRequest(azureProps.blockBlobURL.upload(this._azure.aborter, content, content.length, uploadOptions), { filePath, contentType: 'Buffer' }, filePath)
    return content.length
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _copyRemoteToRemoteFile (srcPath, destPath) {
    const destProps = this._propsForPath(destPath)
    await this._wrapProviderRequest(destProps.blockBlobURL.startCopyFromURL(this._azure.aborter, this._propsForPath(srcPath).blockBlobURL.url), { srcPath, destPath }, srcPath)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  _getUrl (filePath) {
    const azureURL = this._propsForPath(filePath).blockBlobURL.url.split('?')[0]
    const index = azureURL.indexOf(AZURE_STORAGE_DOMAIN)
    return 'https://' + DEFAULT_CDN_STORAGE_HOST + azureURL.substring(index + AZURE_STORAGE_DOMAIN.length)
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
    const presignOptions = Object.assign({ blobName: filePath }, options)
    const cred = await utils.wrapTVMRequest(this.tvm.getAzureBlobPresignCredentials(presignOptions))
    return this._getUrl(filePath) + '?' + cred.signature
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

module.exports = { AzureBlobFiles }
