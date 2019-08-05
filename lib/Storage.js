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

const { StorageError } = require('./StorageError')

// eslint-disable-next-line jsdoc/require-jsdoc
function validateInput (input, joiObject) {
  const res = joi.validate(input, joiObject)
  if (res.error) throw new StorageError(res.error.message, StorageError.codes.BadArgument)
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateFilePath (filePath, label = 'filePath') {
  // todo better path validation than just string !!
  validateInput(filePath, joi.string().label(label).allow('').required())
}

/**
 * @typedef RemotePathString
 * @type {string}
 * @description a string to the remote file path. The path will be treated as
 * a directory if and only if it ends with a `/` otherwise it will be treated
 * as a plain file.
 */

/**
 * Abstract class for remote storage
 *
 * @abstract
 * @class Storage
 */
class Storage {
  /**
   * Initializes and returns a new storage instance
   *
   * @static
   * @param {object} credentials credentials for the cloud provider storage
   * @returns {Promise<Storage>} a new Storage instance
   * @memberof Storage
   */
  static async init (credentials) {
    throw new StorageError('method not implemented.', StorageError.codes.NotImplemented)
  }

  /* **************************** PRIVATE STATIC HELPERS ***************************** */
  // todo to avoid repeating operations, should we assume normalized path for all private file helpers?
  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {string} normalized path
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _normalizeRemotePath (filePath) {
    let res = filePath
    // make absolute for proper normalization (e.g no dot directories)
    if (!res.startsWith('/')) res = '/' + res
    /* here we make sure we treat all path as unix style and relative */
    res = upath.normalize(upath.toUnix(res))
    while (res.startsWith('/')) res = res.substr(1)
    return res
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if it's the root
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _isRemoteRoot (filePath) {
    return Storage._normalizeRemotePath(filePath) === ''
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if the file is public
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _isRemotePublic (filePath) {
    const normalized = Storage._normalizeRemotePath(filePath)
    return normalized.startsWith(Storage.publicPrefix)
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {boolean} true if path is a directory
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _isRemoteDirectory (filePath) {
    // normalize ?
    return filePath.endsWith('/') || filePath === '' || filePath === Storage.publicPrefix
  }

  /**
   * @param {RemotePathString} parentFilePath {@link RemotePathString}
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {string} child path
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _childRemotePath (parentFilePath, filePath) {
    // works also if filePath is a local path
    filePath = Storage._normalizeRemotePath(filePath)
    parentFilePath = Storage._normalizeRemotePath(parentFilePath)

    const childIsDirectory = Storage._isRemoteDirectory(filePath)
    // basename removes trailing /s
    return upath.join(parentFilePath, upath.basename(filePath)) + (childIsDirectory ? '/' : '')
  }

  /**
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @throws {StorageError}
   *
   * @static
   * @protected
   * @memberof Storage
   */
  static _throwIfRemoteFolder (filePath) {
    if (this._isRemoteDirectory(filePath)) throw new StorageError(`remote path ${filePath} must be a file, but is a folder.`, StorageError.codes.BadArgument)
  }

  /**
   * Reads a stream into a buffer
   *
   * @param {NodeJS.ReadableStream} stream readableStream
   * @returns {Promise<Buffer>} buffer
   *
   * @static
   * @protected
   * @memberof Storage
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
   * @param {string} filePath path to the file on which the request was made
   * @returns {Promise} promise resolving to same value as requestPromise
   * @throws {StorageError}
   * @static
   * @protected
   * @memberof Storage
   */
  async _wrapProviderRequest (requestPromise, filePath) {
    return requestPromise.catch(e => {
      const status = this._statusFromProviderError(e)
      if (status) {
        if (filePath && status === 404) throw new StorageError(`remote file '${filePath}' does not exist`, StorageError.codes.FileNotExists)
        if (status === 403) throw new StorageError(`access forbidden, make sure your credentials are valid`, StorageError.codes.Forbidden)
        throw new StorageError(`unknown error response from provider with status ${status}`, StorageError.codes.Internal, e)
      }
    })
  }

  /* **************************** PUBLIC API METHODS ***************************** */
  /**
   * Lists files in a remote folder. If called on a file returns only this file path.
   * This is comparable to bash's `ls` command
   *
   * @param {RemotePathString} [filePath] {@link RemotePathString} if not
   * specified list all files
   * @returns {Promise<Array<string>>} resolves to array of paths
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async list (filePath) {
    if (!filePath) filePath = ''
    validateFilePath(filePath)

    if (Storage._isRemoteDirectory(filePath)) return this._listFolder(filePath)
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
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async delete (filePath, options = {}) {
    validateFilePath(filePath)
    validateInput(options, joi.object().keys({ progressCallback: joi.func() }).label('options').required())

    const elements = await this.list(filePath)
    return Promise.all(elements.map(async fp => {
      await this._deleteFile(fp)
      if (options.progressCallback) options.progressCallback(fp)
      return fp
    }))
  }

  /**
   * **NODEJS ONLY**
   * **Does not work on directories.**
   * Creates a read stream
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async createReadStream (filePath, options = {}) {
    validateFilePath(filePath)
    validateInput(options, joi.object().label('options').keys({ position: joi.number(), length: joi.number() }).required())

    Storage._throwIfRemoteFolder(filePath)

    return this._createReadStream(filePath, options)
  }

  /**
   * **NODEJS ONLY**
   * **Does not work on directories.**
   * [UNSTABLE] in case of problems use write(ReadableStream)
   * Returns a write stream.
   * Use `.on('finish', result => {})` to listen on completion event
   * Alternatively a `promise` attribute can be used to wait on stream completion
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async createWriteStream (filePath) {
    validateFilePath(filePath)

    Storage._throwIfRemoteFolder(filePath)

    return this._createWriteStream(filePath)
  }

  /**
   * **Does not work on directories.**
   * Reads a remote file content
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<Buffer>} buffer holding content
   * @param {object} [options={}] remoteReadOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async read (filePath, options = {}) {
    const stream = await this.createReadStream(filePath, options)
    return Storage._readStream(stream)
  }

  // append support by position option => but not supported by s3
  /**
   * **Does not work on directories.**
   * Writes content to a file
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {string | Buffer | NodeJS.ReadableStream } content to be written,
   * `ReadableStream` input works for **NodeJS only**
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async write (filePath, content) {
    validateFilePath(filePath)
    validateInput(content, joi.alternatives([joi.string(), joi.binary(), joi.object().type(stream.Readable)]).label('content').required())
    Storage._throwIfRemoteFolder(filePath)

    if (content instanceof stream.Readable) {
      return this._writeStream(filePath, content)
    } else {
      if (typeof content === 'string') content = Buffer.from(content)
      return this._writeBuffer(filePath, content)
    }
  }

  /**
   * @typedef RemoteFileProperties
   * @type {object}
   * @property {boolean} isDirectory true if file is a path
   * @property {boolean} isPublic true if file is public
   * @property {string} url remote file url
   * @public
   * @memberof Storage
   */
  /**
   * Reads properties of a file
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<RemoteFileProperties>} resolves to RemoteFileProperties
   * @throws {StorageError}
   *
   * @memberof Storage
   */
  async getProperties (filePath) {
    validateFilePath(filePath)
    // todo go fetch some other properties like exists, size, metadata...
    return {
      isDirectory: Storage._isRemoteDirectory(filePath),
      isPublic: Storage._isRemotePublic(filePath),
      url: this._getUrl(filePath)
    }
  }

  /* **************************** PRIVATE ABSTRACT METHODS TO IMPLEMENT ***************************** */

  /**
   * [INTERNAL] only for folders
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<Array<string>>} resolves to array of paths
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _listFolder (filePath) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<boolean>} resolves to array of paths
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _fileExists (filePath) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<string>} resolves to filePath
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _deleteFile (filePath) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _createReadStream (filePath, options = {}) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _createWriteStream (filePath) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {NodeJS.ReadableStream} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {StorageError}
   *
   * @memberof Storage
   * @protected
   */
  async _writeStream (filePath, content) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @param {Buffer} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {StorageError}
   *
   * @memberof Storage
   * @public
   */
  async _writeBuffer (filePath, content) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * **Does not work for directories.**
   * [INTERNAL] copies a file from a remote location to another.
   *
   * @param {RemotePathString} srcPath {@link RemotePathString}
   * @param {RemotePathString} destPath {@link RemotePathString}
   * @param {object} options options
   * @returns {Promise<string>} resolves to destPath
   *
   * @protected
   * @memberof Storage
   * @abstract
   */
  async _copyRemoteToRemoteFile (srcPath, destPath, options) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * [INTERNAL]
   *
   * @param {RemotePathString} filePath {@link RemotePathString}
   * @returns {string} resolves to url
   *
   * @protected
   * @memberof Storage
   * @abstract
   */
  _getUrl (filePath) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /**
   * [INTERNAL]
   *
   * @param {Error} e provider error response
   * @returns {number} status code
   *
   * @protected
   * @memberof Storage
   * @abstract
   */
  _statusFromProviderError (e) {
    throw new StorageError('method not implemented', StorageError.codes.NotImplemented)
  }

  /* **************************** PUBLIC API HIGH-LEVEL **************************** */
  // todo make copy available to the browser aswell (i.e. if browser, don't use streams)
  /**
   * **NODEJS ONLY**
   * A utility to copy files and directories from and to remote or local locations
   *
   * Rules for copy files are:
   *  1. Remote => Remote
   *    - a/ (dir) => b/: b/a/
   *    - a (file) => b/: b/a  *disallowed if b/a exists and override=false*
   *    - a (file) => b : b    *disallowed if b exists and override=false*
   *    - a/ (dir) => b : b/   *always allowed: in remote storage we can have both b and b/*
   *  2. Remote => Local
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a
   *    - a  => b : b   *disallowed if b exists and override=false*
   *    - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
   *  3. Local => Remote
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a  *disallowed if b/a exists and override=false*
   *    - a  => b : b    *disallowed if b exists and override=false*
   *    - a/ => b: b/    *always allowed: in remote storage we can have both b and b/*
   *  4. Local => Local
   *    - not supported
   *
   * @param {RemotePathString|string} srcPath copy source path to a file or directory. If
   * srcPath points to a local file set `options.localSrc` to true
   * @param {RemotePathString|string} destPath copy destination path to a file or directory. If
   * destPath points to a local file set `options.localDest` to true
   * @param {object} [options={}] remoteCopyOptions
   * @param {boolean} [options.localSrc = false] Set this option to true to copy
   * files from the local file system. Cannot be combined with localDest.
   * @param {boolean} [options.localDest = false] Set this option to true to
   * copy files to the local file system. Cannot be combined with localSrc.
   * @param {boolean} [options.override = true] set to false to never override
   * existing files
   * @param {Function} [options.progressCallback] a function that will be called
   * every time the operation completes on a single file, a path to that file
   * will be passed as argument to the callback `progressCallback(path)`
   * @returns {Promise<Array<string>>} returns path to destination
   * @throws {StorageError}
   * @memberof Storage
   */
  async copy (srcPath, destPath, options = {}) {
    if (!options.override) options.override = true

    validateFilePath(srcPath, 'srcPath')
    validateFilePath(destPath, 'destPath')
    validateInput(options, joi.object().keys({ override: joi.boolean(), localSrc: joi.boolean(), localDest: joi.boolean(), progressCallback: joi.func() }).label('options').required())

    // COPY REMOTE TO REMOTE
    const _copyRemoteToRemote = async (srcPath, destPath, options) => {
      srcPath = Storage._normalizeRemotePath(srcPath)
      destPath = Storage._normalizeRemotePath(destPath)

      const srcIsDirectory = Storage._isRemoteDirectory(srcPath)
      const destIsDirectory = Storage._isRemoteDirectory(destPath)

      if (destIsDirectory) destPath = Storage._childRemotePath(destPath, srcPath)

      const srcFiles = await this.list(srcPath)
      if (srcFiles.length === 0) throw new StorageError(`remote src '${srcPath}' does not exist`, StorageError.codes.FileNotExists)
      if (!options.override && !(srcIsDirectory && !destIsDirectory) && (await this.list(destPath)).length > 0) throw new StorageError(`remote dest '${destPath}' exists and overrides are not allowed`, StorageError.codes.FileExistsNoOverrides)

      if (srcIsDirectory) {
        return Promise.all(srcFiles.map(async f => {
          const newDest = Storage._childRemotePath(destPath, f)
          await this._copyRemoteToRemoteFile(f, newDest, options)
          if (options.progressCallback) options.progressCallback(f)
          return newDest
        }))
      }
      // is file
      await this._copyRemoteToRemoteFile(srcPath, destPath, options)
      if (options.progressCallback) options.progressCallback(destPath)
      return [ destPath ]
    }

    // COPY REMOTE TO LOCAL
    const _copyRemoteToLocal = async (srcPath, destPath, options) => {
      const _downloadFile = async (srcPath, destPath) => {
        // this error should not happen
        if (Storage._isRemoteDirectory(srcPath)) throw new StorageError(`srcPath cannot be a directory.`, StorageError.codes.Internal)

        let localDestStat
        try {
          localDestStat = await fs.stat(destPath)
        } catch (e) {
          if (e.code !== 'ENOENT') throw e // todo wrap error?
        }
        if (localDestStat && !localDestStat.isFile()) throw new StorageError(`destPath is invalid.`, StorageError.codes.Internal)
        return new Promise(async (resolve, reject) => {
          // download file
          const srcStream = await this.createReadStream(srcPath)
          const destStream = fs.createWriteStream(destPath)
          const stream = srcStream.pipe(destStream)
          stream.on('finish', () => resolve(destPath))
          stream.on('error', reject) // todo wrap error?
        })
      }

      srcPath = Storage._normalizeRemotePath(srcPath)
      destPath = upath.resolve(destPath)

      const srcIsDirectory = Storage._isRemoteDirectory(srcPath)
      let destStats
      try {
        destStats = await fs.stat(destPath)
      } catch (e) {
        // if does not exists is fine
        if (e.code !== 'ENOENT') throw e // todo wrap error?
      }
      const destExists = !!destStats
      const destIsFile = destExists && destStats.isFile()
      const destIsDirectory = destExists && destStats.isDirectory()
      if (destExists && !destIsFile && !destIsDirectory) throw new StorageError(`local dest '${destPath}' exists but is not a valid file or directory`, StorageError.codes.BadFileType)
      if (srcIsDirectory && destIsFile) throw new StorageError(`local dest '${destPath}' is a file but remote src is a directory, cannot copy to file.`, StorageError.codes.BadFileType)

      if (destIsDirectory) destPath = upath.join(destPath, upath.basename(srcPath))

      if (!options.override && (await fs.exists(destPath))) throw new StorageError(`local dest '${destPath}' exists and overrides are not allowed`, StorageError.codes.FileExistsNoOverrides)

      const srcFiles = await this.list(srcPath)
      if (srcFiles.length === 0) throw new StorageError(`remote src '${srcPath}' does not exist`, StorageError.codes.FileNotExists)

      if (srcIsDirectory) {
        // src is a folder
        await fs.ensureDir(destPath)
        return Promise.all(srcFiles.map(async f => {
          const destFilePath = upath.join(destPath, upath.basename(f))
          await _downloadFile(f, destFilePath)
          if (options.progressCallback) options.progressCallback(destFilePath)
          return destFilePath
        }))
      }
      // src is a file
      await fs.ensureDir(upath.dirname(destPath))
      await _downloadFile(srcPath, destPath)
      if (options.progressCallback) options.progressCallback(destPath)
      return destPath
    }

    // COPY LOCAL TO REMOTE
    const _copyLocalToRemote = async (srcPath, destPath, options) => {
      const _uploadFile = async (srcPath, destPath) => {
        await this.write(destPath, fs.createReadStream(srcPath))
        return destPath
      }
      const _copy = async (srcPath, destPath, options, first = false) => {
        let stat
        try {
          stat = await fs.stat(srcPath)
        } catch (e) {
          if (e.code === 'ENOENT') throw new StorageError(`local src '${srcPath}' does not exist`, StorageError.codes.FileNotExists)
          throw e // todo wrap error
        }
        const srcIsDirectory = stat.isDirectory()
        const srcIsFile = stat.isFile()
        if (!srcIsFile && !srcIsDirectory) {
          // ignore symlinks during recursion but throw error if explicitely asking to upload symlink
          if (!first) return null
          throw new StorageError(`local src '${srcPath}' exists but is not a valid file nor directory`, StorageError.codes.BadFileType)
        }
        const destIsDirectory = Storage._isRemoteDirectory(destPath)

        if (destIsDirectory) destPath = Storage._childRemotePath(destPath, srcPath)

        if (!options.override && !(srcIsDirectory && !destPath) && (await this.list(destPath)).length > 0) throw new StorageError(`remote dest '${destPath}' exists and overrides are not allowed`, StorageError.codes.FileExistsNoOverrides)

        if (srcIsDirectory) {
          // src is directory
          const files = await fs.readdir(srcPath)
          const res = await Promise.all(files.map(async f => {
            const childSrcPath = upath.join(srcPath, f)
            const childDestPath = Storage._childRemotePath(destPath, childSrcPath)
            return _copy(childSrcPath, childDestPath, options)
          }))
          return res.reduce((prev, curr) => prev.concat(curr), [])
        }
        // src is file - recursion stops
        await _uploadFile(srcPath, destPath)
        if (options.progressCallback) options.progressCallback(destPath)
        return destPath
      }

      // back to _copyLocalToRemote
      srcPath = upath.resolve(srcPath)
      destPath = Storage._normalizeRemotePath(destPath)
      return _copy(srcPath, destPath, options, true)
    }

    if (options.localDest && options.localSrc) throw new StorageError('copy from local to local is not supported, options.localDest and options.localSrc cannot be set together', StorageError.codes.BadArgument)
    if (options.localDest) return _copyRemoteToLocal(srcPath, destPath, options)
    if (options.localSrc) return _copyLocalToRemote(srcPath, destPath, options)
    return _copyRemoteToRemote(srcPath, destPath, options)
  }
}

Storage.publicPrefix = 'public'

module.exports = { Storage }
