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

const { Files } = require('../Files')
const { FilesError } = require('../FilesError')

const STREAM_BLOCK_SIZE = 2 * 1024 * 1024
const STREAM_MAX_BUFFERS = 20

/**
 * creates a container if not exists
 *
 * @param {azure.ContainerURL} containerURL azure ContainerUrl
 * @param {azure.Aborter} aborter azure Aborter
 * @param {boolean} [isPublic=false] set to true to create a public container
 * @private
 */
async function createContainerIfNotExists (containerURL, aborter, isPublic = false) {
  try {
    await containerURL.create(aborter, isPublic ? { access: 'blob' } : {})
  } catch (e) {
    // bug in the past where randomly switch from Code to code.. weird
    if (!(typeof e.body === 'object' && (e.body.Code === 'ContainerAlreadyExists' || e.body.code === 'ContainerAlreadyExists'))) throw e
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
   * @param {module:types~AzureCredentials} credentials {@link module.types~AzureCredentials}
   * @memberof AzureBlobFiles
   * @private
   */
  constructor (credentials) {
    super()
    const res = joi.validate(credentials, joi.object().label('credentials').keys({
      // todo remove duplication with index.js validation!
      // either
      sasURLPrivate: joi.string().uri(),
      sasURLPublic: joi.string().uri(),
      // or
      storageAccessKey: joi.string(),
      storageAccount: joi.string(),
      containerName: joi.string()
    }).required().unknown().and('storageAccount', 'storageAccessKey', 'containerName').and('sasURLPrivate', 'sasURLPublic').xor('sasURLPrivate', 'storageAccount'))
    if (res.error) throw new FilesError(res.error.message, FilesError.codes.BadArgument)

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
   * @param {module:types~AzureCredentials} credentials {@link module.types~AzureCredentials}
   * @returns {Promise<AzureBlobFiles>} new instance
   * @memberof AzureBlobFiles
   */
  static async init (credentials) {
    const azureFiles = new AzureBlobFiles(credentials)

    // container sas creds are not allowed to create containers and so those
    // credentials must point to already existing containers
    if (!azureFiles._azure.sasCreds) {
      // for the non sasCreds case we can make sure those containers exists
      await azureFiles._wrapProviderRequest(createContainerIfNotExists(azureFiles._azure.containerURLPrivate, azureFiles._azure.aborter))
      await azureFiles._wrapProviderRequest(createContainerIfNotExists(azureFiles._azure.containerURLPublic, azureFiles._azure.aborter, true))
    }

    return azureFiles
  }

  /* **************************** PRIVATE HELPERS ***************************** */

  /**
   * @typedef AzurePathProps
   * @type {object}
   * @property {azure.ContainerURL} containerURL private or public Azure blob container
   * @property {azure.BlockBlobURL} blockBlobURL the azure blockBlobURL
   * @property {module:types~RemotePathString} path a normalized remote path
   * @private
   */

  /**
   * [Internal] Parses the input path to determine if it is public or private
   * then returns an internal property object that can be used to access the file
   *
   * @param {module:types~RemotePathString} filePath {module:types~RemotePathString}
   * @returns {AzurePathProps} object containing azure resources and
   * normalized path
   *
   * @private
   * @memberof AzureBlobFiles
   */
  _propsForPath (filePath) {
    const fileProps = {}

    fileProps.path = Files._normalizeRemotePath(filePath)
    if (Files._isRemotePublic(fileProps.path)) {
      fileProps.containerURL = this._azure.containerURLPublic
    } else {
      fileProps.containerURL = this._azure.containerURLPrivate
    }
    fileProps.blockBlobURL = azure.BlockBlobURL.fromContainerURL(fileProps.containerURL, fileProps.path)

    return fileProps
  }

  /* **************************** PRIVATE METHODS TO IMPLEMENT ***************************** */
  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _listFolder (filePath) {
    const __listFolder = async (fileProps) => {
      let elements = []
      let marker
      do {
        const options = { delimiter: '/' }
        // prefix='' works with SAS credentials but breaks with
        // storageAccount credentials => bug in azure?
        if (fileProps.path !== '') options.prefix = fileProps.path
        const response = await this._wrapProviderRequest(fileProps.containerURL.listBlobFlatSegment(this._azure.aborter, marker, options))
        marker = response.marker
        elements = elements.concat(response.segment.blobItems.map(blob => blob.name))
      } while (marker)
      return elements
    }

    const fileProps = this._propsForPath(filePath)
    // case 1 we list the root => need to list both public and private containers
    if (Files._isRemoteRoot(filePath)) {
      const res = await Promise.all([ __listFolder(fileProps), __listFolder(this._propsForPath(Files.publicPrefix)) ])
      return res[0].concat(res[1])
    }
    // case 2 we list a non root folder => only list one container
    return __listFolder(fileProps)
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _fileExists (filePath) {
    const fileProps = this._propsForPath(filePath)
    try {
      await this._wrapProviderRequest(fileProps.blockBlobURL.getProperties(this._azure.aborter), fileProps.path)
    } catch (e) {
      if (e.code === FilesError.codes.FileNotExists) return false
      throw e
    }
    return true
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _deleteFile (filePath) {
    const fileProps = this._propsForPath(filePath)
    await this._wrapProviderRequest(fileProps.blockBlobURL.delete(this._azure.aborter), fileProps.path)
    return fileProps.path
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _createReadStream (filePath, options) {
    const fileProps = this._propsForPath(filePath)
    return (await this._wrapProviderRequest(fileProps.blockBlobURL.download(this._azure.aborter, options.position || 0, options.length), fileProps.path)).readableStreamBody
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
      constructor (fileProps, azureAborter, wrapProviderRequest) {
        super()
        this.bytesWritten = 0
        this.on('data', chunk => { this.bytesWritten += chunk.length })
        this._promise = wrapProviderRequest(azure.uploadStreamToBlockBlob(
          azureAborter,
          this,
          fileProps.blockBlobURL,
          STREAM_BLOCK_SIZE,
          STREAM_MAX_BUFFERS,
          { blobHTTPHeaders: { blobContentType: lookupMimeType(fileProps.path) } }
        ), fileProps.path).then(_ => this.bytesWritten)
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
    const fileProps = this._propsForPath(filePath)
    const uploadOptions = { blobHTTPHeaders: { blobContentType: lookupMimeType(fileProps.path) } }
    let length = 0
    // we know that dependency will wait until end event, so we can simply plug
    // to data event.
    content.on('data', chunk => { length += chunk.length })
    await this._wrapProviderRequest(azure.uploadStreamToBlockBlob(
      this._azure.aborter,
      content,
      fileProps.blockBlobURL,
      STREAM_BLOCK_SIZE,
      STREAM_MAX_BUFFERS,
      uploadOptions
    ), fileProps.path)
    return length
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _writeBuffer (filePath, content) {
    const fileProps = this._propsForPath(filePath)
    const uploadOptions = { blobHTTPHeaders: { blobContentType: lookupMimeType(fileProps.path) } }
    // think about it: supports on upload progress callback
    await this._wrapProviderRequest(fileProps.blockBlobURL.upload(this._azure.aborter, content, content.length, uploadOptions), fileProps.path)
    return content.length
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  async _copyRemoteToRemoteFile (srcPath, destPath) {
    Files._throwIfRemoteDirectory(srcPath)
    Files._throwIfRemoteDirectory(destPath)

    const destProps = this._propsForPath(destPath)
    const srcProps = this._propsForPath(srcPath)

    await this._wrapProviderRequest(destProps.blockBlobURL.startCopyFromURL(this._azure.aborter, srcProps.blockBlobURL.url), srcProps.path)
    return destPath
  }

  /**
   * @memberof AzureBlobFiles
   * @override
   * @private
   */
  _getUrl (filePath) {
    return this._propsForPath(filePath).blockBlobURL.url.split('?')[0]
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