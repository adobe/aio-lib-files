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

const upath = require('upath')
const fs = require('fs-extra')
const joi = require('@hapi/joi')
const stream = require('stream')
const cloneDeep = require('lodash.clonedeep')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

const { codes, logAndThrow } = require('./FilesError')

require('./types.jsdoc') // for VS Code autocomplete
/* global RemotePathString, RemoteFileProperties */ // for linter

// eslint-disable-next-line jsdoc/require-jsdoc
function validateInput (input, schema, details) {
  const res = schema.validate(input)
  if (res.error) logAndThrow(new codes.ERROR_BAD_ARGUMENT({ messageValues: [res.error.message], sdkDetails: cloneDeep(details) }))
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateFilePath (filePath, details, label = 'filePath') {
  // todo better path validation than just string !!
  validateInput(filePath, joi.string().label(label).allow('').required(), details)
}

// eslint-disable-next-line jsdoc/require-jsdoc
function throwNotImplemented (funcName) {
  logAndThrow(new codes.ERROR_NOT_IMPLEMENTED({ messageValues: [funcName] }))
}

const PUBLIC_URL = 'public'
const RUNTIME_URL = 'runtime'

const UrlType = {
  public: PUBLIC_URL,
  runtime: RUNTIME_URL
}

/**
 * @abstract
 * @class Files
 * @classdesc Cloud Files Abstraction
 * @hideconstructor
 */
class Files {
  /**
   * Initializes and returns a new Files instance
   *
   * @param {boolean} _isTest set this to true to allow construction
   * @memberof Files
   * @abstract
   * @private
   */
  constructor (_isTest) {
    if (new.target === Files && !_isTest) throwNotImplemented('Files')
  }

  /**
   * @static
   * @param {object} credentials abstract credentials
   * @returns {Promise<Files>} a new Files instance
   * @memberof Files
   * @abstract
   * @private
   */
  static async init (credentials) {
    throwNotImplemented('init')
  }

  /* **************************** PRIVATE STATIC HELPERS ***************************** */

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {string} normalized path
   *
   * @static
   * @protected
   * @memberof Files
   */
  static _normalizeRemotePath (filePath) {
    let res = filePath
    // make absolute for proper normalization (e.g no dot directories)
    if (!res.startsWith('/')) res = '/' + res
    /* here we make sure we treat all path as unix style and relative */
    res = upath.toUnix(upath.normalize(res)) // keeps latest /
    while (res.startsWith('/')) res = res.substr(1)
    return res
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if it's the root
   *
   * @static
   * @protected
   * @memberof Files
   */
  static _isRemoteRoot (filePath) {
    // filePath must be normalized, e.g '/' would become ''
    return filePath === ''
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if the file is public
   *
   * @static
   * @protected
   * @memberof Files
   */
  static _isRemotePublic (filePath) {
    return filePath === Files.publicPrefix || filePath.startsWith(Files.publicPrefix + '/')
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if path is a directory
   *
   * @static
   * @protected
   * @memberof Files
   */
  static _isRemoteDirectory (filePath) {
    return filePath.endsWith('/') || filePath === '' || filePath === Files.publicPrefix
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} details pass details to error for debugging purpose (e.g. calling function params)
   * @throws {codes.ERROR_BAD_ARGUMENT}
   *
   * @static
   * @protected
   * @memberof Files
   */
  static _throwIfRemoteDirectory (filePath, details) {
    if (this._isRemoteDirectory(filePath)) logAndThrow(new codes.ERROR_BAD_FILE_TYPE({ messageValues: [`${filePath} is a directory but should be a file`], sdkDetails: cloneDeep(details) }))
  }

  /**
   * Reads a stream into a buffer
   *
   * @param {NodeJS.ReadableStream} stream readableStream
   * @returns {Promise<Buffer>} buffer
   *
   * @static
   * @protected
   * @memberof Files
   */
  static async _readStream (stream) {
    return new Promise((resolve, reject) => {
      const chunks = []
      stream.on('data', data => {
        chunks.push(data)
      })
      stream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      stream.on('error', reject)
    })
  }

  /* **************************** PRIVATE INSTANCE HELPERS ***************************** */

  /**
   * Wraps errors for request to the cloud provider
   *
   * @param {Promise} requestPromise the promise resolving to the response or error
   * @param {object} details pass details to error for debugging purpose (e.g. pass function params)
   * @param {string} filePath path to the file on which the request was made
   * @returns {Promise} promise resolving to same value as requestPromise
   * @throws {codes.ERROR_BAD_CREDENTIALS|codes.ERROR_FILE_NOT_EXISTS|codes.ERROR_INTERNAL}
   * @static
   * @protected
   * @memberof Files
   */
  // todo redo error handling this is too specific, error prone and does not scale when we support more providers + cannot catch error thrown by wrap cause we log the error
  async _wrapProviderRequest (requestPromise, details, filePath) {
    const copyDetails = cloneDeep(details)
    return requestPromise.catch(e => {
      const status = this._statusFromProviderError(e)
      if (!filePath && status === 404) return null
      if (filePath && status === 404) logAndThrow(new codes.ERROR_FILE_NOT_EXISTS({ messageValues: [filePath], sdkDetails: copyDetails }))
      if (status === 403) logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['cloud storage provider'], sdkDetails: copyDetails }))
      // todo do better, this is too specific to be handled here
      if (status === 416 && details.options.position !== undefined) logAndThrow(new codes.ERROR_OUT_OF_RANGE({ messageValues: [`options.position ${details.options.position} out of range for file ${filePath}`], sdkDetails: copyDetails }))
      logAndThrow(new codes.ERROR_INTERNAL({ messageValues: [`unknown error response from provider with status: ${status || 'unknown'}`], sdkDetails: { ...copyDetails, _internal: e } }))
    })
  }

  /* **************************** PRIVATE ABSTRACT METHODS TO IMPLEMENT ***************************** */

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<Array<string>>} resolves to array of paths
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _listFolder (filePath) {
    throwNotImplemented('_listFolder')
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<boolean>} resolves to array of paths
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _fileExists (filePath) {
    throwNotImplemented('_fileExists')
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @memberof Files
   * @abstract
   * @protected
   */
  async _deleteFile (filePath) {
    throwNotImplemented('_deleteFile')
  }

  /**
   * **NODEJS ONLY**
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file. By default is set to 0. If set to bigger than
   * size, throws an ERROR_OUT_OF_RANGE error
   * @param {number} [options.length] number of bytes to read. By default reads everything since starting position. If
   * set to bigger than file size, reads until end.
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _createReadStream (filePath, options) {
    throwNotImplemented('_createReadStream')
  }

  /**
   * **NODEJS ONLY**
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _createWriteStream (filePath) {
    throwNotImplemented('_createWriteStream')
  }

  /**
   * **NODEJS ONLY**
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {NodeJS.ReadableStream} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _writeStream (filePath, content) {
    throwNotImplemented('_writeStream')
  }

  /**
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {Buffer} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   *
   * @memberof Files
   * @abstract
   * @protected
   */
  async _writeBuffer (filePath, content) {
    throwNotImplemented('_writeBuffer')
  }

  /**
   * **Does not work for directories.**
   * copies a file from a remote location to another.
   *
   * @param {RemotePathString} srcPath {@link RemotePathString}
   * @param {RemotePathString} destPath {@link RemotePathString}
   *
   * @protected
   * @memberof Files
   * @abstract
   */
  async _copyRemoteToRemoteFile (srcPath, destPath) {
    throwNotImplemented('_copyRemoteToRemoteFile')
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {string} urlType type of URL to return public | runtime, defaults to public
   * @returns {string} resolves to url
   *
   * @protected
   * @memberof Files
   * @abstract
   */
  _getUrl (filePath, urlType = UrlType.public) {
    throwNotImplemented('_getUrl')
  }

  /**
   * [INTERNAL]
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} options Options to generate presign URL
   * @param {string} options.blobName file path
   * @param {number} options.expiryInSeconds presign URL expiry duration
   * @returns {string} resolves to presign url
   *
   * @private
   * @memberof Files
   * @abstract
   */
  async _getPresignUrl (filePath, options) {
    throwNotImplemented('_getPresignUrl')
  }

  /**
   * [INTERNAL]
   *
   * @param {Error} e provider error response
   * @returns {number} status code
   *
   * @protected
   * @memberof Files
   * @abstract
   */
  _statusFromProviderError (e) {
    throwNotImplemented('_statusFromProviderError')
  }

  /* **************************** PUBLIC API METHODS ***************************** */
  /**
   * Lists files in a remote folder. If called on a file returns only this file path.
   * This is comparable to bash's `ls` command
   *
   * @param {RemotePathString} [filePath] {@link RemotePathString} if not
   * specified list all files
   * @returns {Promise<Array<string>>} resolves to array of paths
   *
   * @memberof Files
   * @public
   */
  async list (filePath) {
    if (!filePath) filePath = ''

    validateFilePath(filePath, { filePath })

    filePath = Files._normalizeRemotePath(filePath)

    if (Files._isRemoteDirectory(filePath)) {
      logger.debug(`listing files in folder '${filePath}'`)
      return this._listFolder(filePath)
    }
    logger.debug(`checking existence of file '${filePath}'`)
    if (await this._fileExists(filePath)) return [filePath]
    return []
  }

  /**
   * Deletes a remote file or directory
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} [options={}] remoteDeleteOptions
   * @param {Function} [options.progressCallback] cb(RemoteFile) is called after
   *  the operation completed on each file
   * @returns {Promise<Array<string>>} resolves to array of deleted paths
   *
   * @memberof Files
   * @public
   */
  async delete (filePath, options = {}) {
    const details = { filePath, options }
    validateFilePath(filePath, details)
    validateInput(options, joi.object().keys({ progressCallback: joi.func() }).label('options').required(), details)

    const elements = await this.list(filePath)
    logger.debug(`deleting ${elements.length} files`)
    return Promise.all(elements.map(async fp => {
      await this._deleteFile(fp)
      if (options.progressCallback) options.progressCallback(fp)
      return fp
    }))
  }

  /**
   * ***NodeJS only (streams). Does not work on directories.***
   *
   * Creates a read stream
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file. By default is set to 0. If set to bigger than
   * size, throws an ERROR_OUT_OF_RANGE error
   * @param {number} [options.length] number of bytes to read. By default reads everything since starting position. If
   * set to bigger than file size, reads until end.
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   *
   * @memberof Files
   * @public
   */
  async createReadStream (filePath, options = {}) {
    const details = { filePath, options }
    validateFilePath(filePath, details)
    validateInput(options, joi.object().label('options').keys({ position: joi.number().min(0), length: joi.number().min(0) }).required(), details)

    filePath = Files._normalizeRemotePath(filePath)
    Files._throwIfRemoteDirectory(filePath, details)

    options.position = options.position || 0

    logger.debug(`creating read stream for file '${filePath}' at position ${options.position} and length ${options.length}`)
    return this._createReadStream(filePath, options)
  }

  /**
   * **[UNSTABLE] please prefer using `write(<NodeJS.ReadableStream>)`**
   *
   * ***NodeJS only (streams). Does not work on directories.***
   *
   * Returns a write stream.
   * Use `stream.on('finish', (bytesWritten) => {})` to listen on completion event
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   *
   * @memberof Files
   * @public
   */
  async createWriteStream (filePath) {
    const details = { filePath }
    validateFilePath(filePath, details)

    filePath = Files._normalizeRemotePath(filePath)
    Files._throwIfRemoteDirectory(filePath, details)

    logger.debug(`creating write stream for file '${filePath}'`)
    return this._createWriteStream(filePath)
  }

  /**
   * ***Does not work on directories.***
   *
   * Reads a remote file content
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<Buffer>} buffer holding content
   * @param {object} [options={}] remoteReadOptions
   * @param {number} [options.position] read start position of the file. By default is set to 0. If set to bigger than
   * size, throws an ERROR_OUT_OF_RANGE error
   * @param {number} [options.length] number of bytes to read. By default reads everything since starting position. If
   * set to bigger than file size, reads until end.
   *
   * @memberof Files
   * @public
   */
  async read (filePath, options = {}) {
    // todo performance consideration, maybe it's better to directly get the
    // buffer (especially for small files)?
    logger.debug(`reading '${filePath}'`)
    const stream = await this.createReadStream(filePath, options)
    return Files._readStream(stream)
  }

  // append support by position option => but not supported by s3
  /**
   * ***Does not work on directories.***
   *
   * Writes content to a file
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {string | Buffer | NodeJS.ReadableStream } content to be written,
   * `ReadableStream` input works for **NodeJS only**
   * @returns {Promise<number>} resolves to number of bytes written
   *
   * @memberof Files
   * @public
   */
  async write (filePath, content) {
    const contentType = (content === undefined || content === null) ? undefined : content.constructor.name
    const details = { filePath, contentType } // don't pass all content to error detail
    validateFilePath(filePath, details)
    validateInput(content, joi.alternatives([joi.string(), joi.binary(), joi.object().instance(stream.Readable)]).label('content').required(), details)

    filePath = Files._normalizeRemotePath(filePath)
    Files._throwIfRemoteDirectory(filePath, details)

    if (content instanceof stream.Readable) {
      logger.debug(`writing a read stream to '${filePath}'`)
      return this._writeStream(filePath, content)
    } else {
      if (typeof content === 'string') content = Buffer.from(content)
      logger.debug(`writing a buffer to '${filePath}' of size ${content.length}`)
      return this._writeBuffer(filePath, content)
    }
  }
  /**
   * Reads properties of a file or directory
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<RemoteFileProperties>} resolves {@link RemoteFileProperties}
   *
   * @memberof Files
   */
  // eslint-disable-next-line lines-between-class-members
  async getProperties (filePath) {
    validateFilePath(filePath, { filePath })
    filePath = Files._normalizeRemotePath(filePath)
    logger.debug(`getting file properties for '${filePath}'`)
    // todo go fetch some other properties like exists, size, metadata...
    return {
      isDirectory: Files._isRemoteDirectory(filePath),
      isPublic: Files._isRemotePublic(filePath),
      url: this._getUrl(filePath),
      runtimeUrl: this._getUrl(filePath, UrlType.runtime)
    }
  }

  /**
   * ***NodeJS only (streams + fs).***
   *
   * A utility function to copy files and directories across remote and local Files.
   * This is comparable to the `scp` command
   *
   * Rules for copy files are:
   *  1. Remote => Remote
   *    - a/ (dir) => b/: b/a/
   *    - a (file) => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
   *    - a (file) => b : b    *does nothing if b exists and noOverwrite=true*
   *    - a/ (dir) => b : b/   *always allowed: in remote Files we can have both b and b/*
   *  2. Remote => Local
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a *does nothing if b/a exists and noOverwrite=true*
   *    - a  => b : b   *does nothing if b exists and noOverwrite=true*
   *    - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
   *  3. Local => Remote
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
   *    - a  => b : b    *does nothing if b exists and noOverwrite=true*
   *    - a/ => b: b/    *always allowed: in remote Files we can have both b and b/*
   *  4. Local => Local
   *    - not supported
   *
   * @param {RemotePathString} srcPath copy source path to a file or directory. If
   * srcPath points to a local file set `options.localSrc` to true
   * @param {RemotePathString} destPath copy destination path to a file or directory. If
   * destPath points to a local file set `options.localDest` to true
   * @param {object} [options={}] remoteCopyOptions
   * @param {boolean} [options.localSrc = false] Set this option to true to copy
   * files from the local file system. Cannot be combined with localDest.
   * @param {boolean} [options.localDest = false] Set this option to true to
   * copy files to the local file system. Cannot be combined with localSrc.
   * @param {boolean} [options.noOverwrite = false] set to true to overwrite
   * existing files
   * @param {Function} [options.progressCallback] a function that will be called
   * every time the operation completes on a single file,the srcPath and destPath to the copied file
   * are passed as argument to the callback `progressCallback(srcPath, destPath)`
   * @returns {Promise<object<string, string>>} returns a promise resolving to an object containing all copied files
   * from src to dest `{ srcFilePath: destFilePath }`
   * @memberof Files
   */
  async copy (srcPath, destPath, options = {}) {
    // details to pass in case of error
    const details = { srcPath, destPath, options }

    /* ****** copy helpers ****** */
    const _normalize = (filePath, isLocal = false) => {
      if (isLocal) {
        return upath.toUnix(upath.resolve(filePath)) + (filePath.endsWith('/') ? '/' : '') // keep trailing / important in case local dest doesn't exist
      }
      return Files._normalizeRemotePath(filePath)
    }
    const _getFiles = async (filePath, isLocal = false, localFileStats) => {
      if (isLocal) {
        if (!localFileStats) return []
        if (localFileStats.isFile()) return [filePath]
        // is dir
        const _recursiveReaddir = async dir => {
          const dirents = await fs.readdir(dir, { withFileTypes: true })
          const childs = await Promise.all(dirents.map(async dirent => {
            const res = upath.toUnix(upath.join(dir, dirent.name))
            return dirent.isDirectory() ? _recursiveReaddir(res) : (dirent.isFile() ? res : null)
          }))
          return childs
            .reduce((prev, curr) => prev.concat(curr), [])
            .filter(f => f !== null) // remove all non file/non dir
        }
        return _recursiveReaddir(filePath)
      }
      return this.list(filePath)
    }
    const _isExtendable = (filePath, isLocal, localFileStats) => {
      if (isLocal) {
        if (localFileStats) return localFileStats.isDirectory()
        // does not exist
        return filePath.endsWith('/')
      }
      return Files._isRemoteDirectory(filePath)
    }
    const _extendPath = (parent, child) => {
      // join removes trailing /, but this trailing / is important for remote files as it defines if dir or file
      return upath.toUnix(upath.join(parent, upath.basename(child))) + (child.endsWith('/') ? '/' : '')
    }
    const _isDir = (filePath, isLocal, localFileStats) => {
      if (isLocal) {
        return (localFileStats && localFileStats.isDirectory())
      }
      return Files._isRemoteDirectory(filePath)
    }
    const _getLocalFileStats = async (filePath) => {
      const stats = await fs.stat(filePath).catch(e => { if (e.code !== 'ENOENT') throw e })
      if (stats && !stats.isDirectory() && !stats.isFile()) {
        logAndThrow(new codes.ERROR_BAD_FILE_TYPE({ messageValues: [`${filePath} should be a directory or a file but has an unsupported type (maybe symlink?)`], sdkDetails: cloneDeep(details) }))
      }
      return stats
    }
    const _downloadFile = async (src, dest) => {
      // 1. create needed dirs
      await fs.ensureDir(upath.dirname(dest))
      // 2. download
      const srcStream = await this.createReadStream(src) // use _createReadStream instead ?
      const destStream = fs.createWriteStream(dest)
      return new Promise((resolve, reject) => {
        const stream = srcStream.pipe(destStream)
        stream.on('finish', () => resolve(dest))
        stream.on('error', reject) // todo wrap error?
      })
    }
    const _uploadFile = async (src, dest) => {
      await this.write(dest, fs.createReadStream(src)) // use _writeStream instead ?
      return dest
    }
    const _copyFiles = async (mapping, options) => {
      return Promise.all(Object.entries(mapping).map(async ([src, dest]) => {
        if (options.localDest) {
          await _downloadFile(src, dest)
        } else if (options.localSrc) {
          await _uploadFile(src, dest)
        } else {
          await this._copyRemoteToRemoteFile(src, dest)
        }
        if (options.progressCallback) options.progressCallback(src, dest)
        return dest
      }))
    }
    /* ****** copy helpers end ****** */
    validateFilePath(srcPath, details, 'srcPath')
    validateFilePath(destPath, details, 'destPath')
    // todo this does not allow both localSrc and localDest to be set (should allow if both or one is false)
    validateInput(options, joi.object().keys({ noOverwrite: joi.boolean(), localSrc: joi.boolean(), localDest: joi.boolean(), progressCallback: joi.func() }).oxor('localSrc', 'localDest').label('options').required(), details)

    logger.debug(`copy args: srcPath=${srcPath},
  destPath=${destPath},
  options.localSrc=${!!options.localSrc},
  options.localDest=${!!options.localDest},
  options.noOverwrite=${!!options.noOverwrite},
  options.progressCallback=${options.progressCallback && 'yes'}`)

    const normalizedSrcPath = _normalize(srcPath, options.localSrc)
    const normalizedDestPath = _normalize(destPath, options.localDest)

    const localSrcStats = options.localSrc && await _getLocalFileStats(normalizedSrcPath)
    const localDestStats = options.localDest && await _getLocalFileStats(normalizedDestPath)

    const srcIsDirectory = _isDir(normalizedSrcPath, options.localSrc, localSrcStats)
    logger.debug(`srcPath is a directory: ${srcIsDirectory}`)

    // rule 2.4, copy src folder to dest file not allowed only when dest is local. In remote setting you can have
    // a/file and a/file/file2
    if (localDestStats && localDestStats.isFile() && srcIsDirectory) {
      logAndThrow(new codes.ERROR_BAD_FILE_TYPE({ messageValues: [`local dest ${destPath} is a file but src is a directory, cannot copy to file`], sdkDetails: cloneDeep(details) }))
    }

    // extend destination with src basename, works both if src is a file or dir
    const extendedDestPath = _isExtendable(normalizedDestPath, options.localDest, localDestStats) ? _extendPath(normalizedDestPath, normalizedSrcPath) : normalizedDestPath
    logger.debug(`extended destPath: from '${normalizedDestPath}' to '${extendedDestPath}'`)

    const allSrcFiles = await _getFiles(normalizedSrcPath, options.localSrc, localSrcStats)
    if (allSrcFiles.length === 0) logAndThrow(new codes.ERROR_FILE_NOT_EXISTS({ messageValues: [srcPath], sdkDetails: cloneDeep(details) }))
    logger.debug(`listed ${allSrcFiles.length} src files in '${normalizedSrcPath}'`)

    const srcToDestFilesMapping = allSrcFiles.reduce((obj, fileToCopy) => {
      obj[fileToCopy] = srcIsDirectory
      // note `relative` and not `basename` as in _extendPath
      // => We want to copy the folder structure of src dir to dest
        ? upath.toUnix(upath.join(extendedDestPath, upath.relative(normalizedSrcPath, fileToCopy)))
      // if srcPath is a file we just have one file and the dest path is already extendedDestPath
        : extendedDestPath
      return obj
    }, {})

    if (options.noOverwrite) {
      // corner case: if dest is a remote file (e.g `a/file`) and src is a dir => we want to list the dest dir (`a/file/`) not the file (listing a file = checking if it exists)
      const destToCheck = (srcIsDirectory && !options.localDest && !Files._isRemoteDirectory(normalizedDestPath)) ? normalizedDestPath + '/' : normalizedDestPath

      // we need to filter out files to copy if already existing in dest
      const existingDestFiles = new Set(await _getFiles(destToCheck, options.localDest, localDestStats))
      Object.entries(srcToDestFilesMapping).map(([k, v]) => {
        if (existingDestFiles.has(v)) {
          logger.debug(`not copying '${k}' to '${v}' because of option.noOverwrite=true`)
          delete srcToDestFilesMapping[k]
        }
      })
    }
    logger.debug(`copying src to dest using Map: ${JSON.stringify(srcToDestFilesMapping, null, 2)}`)
    await _copyFiles(srcToDestFilesMapping, options)
    return srcToDestFilesMapping
  }

  /**
   * Generate pre-sign URLs for a private file
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} options Options to generate presign URL
   * @param {string} options.blobName file path
   * @param {number} options.expiryInSeconds presign URL expiry duration
   * @param {string} options.urlType type of URL to return public | runtime, defaults to public
   * @returns {Promise<RemoteFileProperties>} resolves {@link RemoteFileProperties}
   *
   * @memberof Files
   */
  async generatePresignURL (filePath, options) {
    validateFilePath(filePath, { filePath })
    filePath = Files._normalizeRemotePath(filePath)
    logger.debug(`getting presign URL for file '${filePath}'`)
    return await this._getPresignUrl(filePath, options)
  }
}

Files.publicPrefix = 'public' // important do not end with '/'

module.exports = { Files, UrlType }
