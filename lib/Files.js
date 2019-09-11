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

const { FilesError } = require('./FilesError')

// eslint-disable-next-line jsdoc/require-jsdoc
function validateInput (input, joiObject) {
  const res = joi.validate(input, joiObject)
  if (res.error) throw new FilesError(res.error.message, FilesError.codes.BadArgument)
}

// eslint-disable-next-line jsdoc/require-jsdoc
function validateFilePath (filePath, label = 'filePath') {
  // todo better path validation than just string !!
  validateInput(filePath, joi.string().label(label).allow('').required())
}

// eslint-disable-next-line jsdoc/require-jsdoc
function throwNotImplemented (funcName) {
  throw new FilesError(`method ${funcName} not implemented.`, FilesError.codes.NotImplemented)
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
  // todo to avoid repeating operations, should we assume normalized path for all private file helpers?
  /**
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {string} normalized path
   *
   * @static
   * @private
   * @memberof Files
   */
  static _normalizeRemotePath (filePath) {
    let res = filePath
    // make absolute for proper normalization (e.g no dot directories)
    if (!res.startsWith('/')) res = '/' + res
    /* here we make sure we treat all path as unix style and relative */
    res = upath.toUnix(upath.normalize(res))
    while (res.startsWith('/')) res = res.substr(1)
    return res
  }

  /**
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {boolean} true if it's the root
   *
   * @static
   * @private
   * @memberof Files
   */
  static _isRemoteRoot (filePath) {
    return Files._normalizeRemotePath(filePath) === ''
  }

  /**
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {boolean} true if the file is public
   *
   * @static
   * @private
   * @memberof Files
   */
  static _isRemotePublic (filePath) {
    const normalized = Files._normalizeRemotePath(filePath)
    return normalized.startsWith(Files.publicPrefix)
  }

  /**
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {boolean} true if path is a directory
   *
   * @static
   * @private
   * @memberof Files
   */
  static _isRemoteDirectory (filePath) {
    const normalized = Files._normalizeRemotePath(filePath)
    return normalized.endsWith('/') || normalized === '' || normalized === Files.publicPrefix
  }

  /**
   * @param {module:types~RemotePathString} parentFilePath {@link module:types~RemotePathString}
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {string} [relativeTo=''] set this to keep a sub path from
   * relativeTo to filePath, if not set only the filename will be appended to
   * the parentFilePath
   * @returns {string} child path
   *
   * @static
   * @private
   * @memberof Files
   */
  static _childRemotePath (parentFilePath, filePath, relativeTo = '') {
    // works also if filePath is a local path
    filePath = Files._normalizeRemotePath(filePath)
    parentFilePath = Files._normalizeRemotePath(parentFilePath)

    const childIsDirectory = Files._isRemoteDirectory(filePath)
    // basename and relative removes trailing /s
    return upath.toUnix(upath.join(parentFilePath, (relativeTo ? upath.relative(relativeTo, filePath) : upath.basename(filePath)))) + (childIsDirectory ? '/' : '')
  }

  /**
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @throws {FilesError}
   *
   * @static
   * @private
   * @memberof Files
   */
  static _throwIfRemoteDirectory (filePath) {
    if (this._isRemoteDirectory(filePath)) throw new FilesError(`remote path ${filePath} must be a file, but is a directory.`, FilesError.codes.BadArgument)
  }

  /**
   * Reads a stream into a buffer
   *
   * @param {NodeJS.ReadableStream} stream readableStream
   * @returns {Promise<Buffer>} buffer
   *
   * @static
   * @private
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
   * @param {string} filePath path to the file on which the request was made
   * @returns {Promise} promise resolving to same value as requestPromise
   * @throws {FilesError}
   * @static
   * @private
   * @memberof Files
   */
  async _wrapProviderRequest (requestPromise, filePath) {
    return requestPromise.catch(e => {
      const status = this._statusFromProviderError(e)
      if (filePath && status === 404) throw new FilesError(`remote file '${filePath}' does not exist`, FilesError.codes.FileNotExists, e)
      if (status === 403) throw new FilesError(`access forbidden, make sure your credentials are valid`, FilesError.codes.Forbidden, e)
      throw new FilesError(`unknown error response from provider with status ${status || 'unknown'}`, FilesError.codes.Internal, e)
    })
  }

  /* **************************** PRIVATE ABSTRACT METHODS TO IMPLEMENT ***************************** */

  /**
   * [INTERNAL] only for folders
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<Array<string>>} resolves to array of paths
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _listFolder (filePath) {
    throwNotImplemented('_listFolder')
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<boolean>} resolves to array of paths
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _fileExists (filePath) {
    throwNotImplemented('_fileExists')
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<string>} resolves to filePath
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _deleteFile (filePath) {
    throwNotImplemented('_deleteFile')
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _createReadStream (filePath, options) {
    throwNotImplemented('_createReadStream')
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _createWriteStream (filePath) {
    throwNotImplemented('_createWriteStream')
  }

  /**
   * **NODEJS ONLY**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {NodeJS.ReadableStream} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _writeStream (filePath, content) {
    throwNotImplemented('_writeStream')
  }

  /**
   * [INTERNAL] only for files
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {Buffer} content to be written
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {FilesError}
   *
   * @memberof Files
   * @abstract
   * @private
   */
  async _writeBuffer (filePath, content) {
    throwNotImplemented('_writeBuffer')
  }

  /**
   * **Does not work for directories.**
   * [INTERNAL] copies a file from a remote location to another.
   *
   * @param {module:types~RemotePathString} srcPath {@link module:types~RemotePathString}
   * @param {module:types~RemotePathString} destPath {@link module:types~RemotePathString}
   * @param {object} options options
   * @returns {Promise<string>} resolves to destPath
   *
   * @private
   * @memberof Files
   * @abstract
   */
  async _copyRemoteToRemoteFile (srcPath, destPath, options) {
    throwNotImplemented('_copyRemoteToRemoteFile')
  }

  /**
   * [INTERNAL]
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {string} resolves to url
   *
   * @private
   * @memberof Files
   * @abstract
   */
  _getUrl (filePath) {
    throwNotImplemented('_getUrl')
  }

  /**
   * [INTERNAL]
   *
   * @param {Error} e provider error response
   * @returns {number} status code
   *
   * @private
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
   * @param {module:types~RemotePathString} [filePath] {@link module:types~RemotePathString} if not
   * specified list all files
   * @returns {Promise<Array<string>>} resolves to array of paths
   * @throws {FilesError}
   *
   * @memberof Files
   * @public
   */
  async list (filePath) {
    if (!filePath) filePath = ''
    validateFilePath(filePath)

    filePath = Files._normalizeRemotePath(filePath)

    if (Files._isRemoteDirectory(filePath)) return this._listFolder(filePath)
    if (await this._fileExists(filePath)) return [filePath]
    return []
  }

  /**
   * Deletes a remote file or directory
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {object} [options={}] remoteDeleteOptions
   * @param {Function} [options.progressCallback] cb(RemoteFile) is called after
   *  the operation completed on each file
   * @returns {Promise<Array<string>>} resolves to array of deleted paths
   * @throws {FilesError}
   *
   * @memberof Files
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
   * ***NodeJS only (streams). Does not work on directories.***
   *
   * Creates a read stream
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {object} [options={}] createReadStreamOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @returns {Promise<NodeJS.ReadableStream>} a readable stream
   * @throws {FilesError}
   *
   * @memberof Files
   * @public
   */
  async createReadStream (filePath, options = {}) {
    validateFilePath(filePath)
    validateInput(options, joi.object().label('options').keys({ position: joi.number(), length: joi.number() }).required())

    Files._throwIfRemoteDirectory(filePath)

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
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<NodeJS.WritableStream>} a writable stream
   * @throws {FilesError}
   *
   * @memberof Files
   * @public
   */
  async createWriteStream (filePath) {
    validateFilePath(filePath)

    Files._throwIfRemoteDirectory(filePath)

    return this._createWriteStream(filePath)
  }

  /**
   * ***Does not work on directories.***
   *
   * Reads a remote file content
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<Buffer>} buffer holding content
   * @param {object} [options={}] remoteReadOptions
   * @param {number} [options.position] read start position of the file
   * @param {number} [options.length] number of bytes to read
   * @throws {FilesError}
   *
   * @memberof Files
   * @public
   */
  async read (filePath, options = {}) {
    // todo performance consideration, maybe it's better to directly get the
    // buffer (especially for small files)?
    const stream = await this.createReadStream(filePath, options)
    return Files._readStream(stream)
  }

  // append support by position option => but not supported by s3
  /**
   * ***Does not work on directories.***
   *
   * Writes content to a file
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @param {string | Buffer | NodeJS.ReadableStream } content to be written,
   * `ReadableStream` input works for **NodeJS only**
   * @returns {Promise<number>} resolves to number of bytes written
   * @throws {FilesError}
   *
   * @memberof Files
   * @public
   */
  async write (filePath, content) {
    validateFilePath(filePath)
    validateInput(content, joi.alternatives([joi.string(), joi.binary(), joi.object().type(stream.Readable)]).label('content').required())
    Files._throwIfRemoteDirectory(filePath)

    if (content instanceof stream.Readable) {
      return this._writeStream(filePath, content)
    } else {
      if (typeof content === 'string') content = Buffer.from(content)
      return this._writeBuffer(filePath, content)
    }
  }
  /**
   * Reads properties of a file or directory
   *
   * @param {module:types~RemotePathString} filePath {@link module:types~RemotePathString}
   * @returns {Promise<module:types~RemoteFileProperties>} resolves {@link module:types~RemoteFileProperties}
   *
   * @memberof Files
   */
  async getProperties (filePath) {
    validateFilePath(filePath)
    // todo go fetch some other properties like exists, size, metadata...
    return {
      isDirectory: Files._isRemoteDirectory(filePath),
      isPublic: Files._isRemotePublic(filePath),
      url: this._getUrl(filePath)
    }
  }

  // todo make copy available to the browser aswell (i.e. if browser, don't use streams)
  /**
   * ***NodeJS only (streams).***
   *
   * A utility function to copy files and directories across remote and local Files.
   * This is comparable to the `scp` command
   *
   * Rules for copy files are:
   *  1. Remote => Remote
   *    - a/ (dir) => b/: b/a/
   *    - a (file) => b/: b/a  *disallowed if b/a exists and override=false*
   *    - a (file) => b : b    *disallowed if b exists and override=false*
   *    - a/ (dir) => b : b/   *always allowed: in remote Files we can have both b and b/*
   *  2. Remote => Local
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a
   *    - a  => b : b   *disallowed if b exists and override=false*
   *    - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
   *  3. Local => Remote
   *    - a/ => b/: b/a/
   *    - a  => b/: b/a  *disallowed if b/a exists and override=false*
   *    - a  => b : b    *disallowed if b exists and override=false*
   *    - a/ => b: b/    *always allowed: in remote Files we can have both b and b/*
   *  4. Local => Local
   *    - not supported
   *
   * @param {module:types~RemotePathString} srcPath copy source path to a file or directory. If
   * srcPath points to a local file set `options.localSrc` to true
   * @param {module:types~RemotePathString} destPath copy destination path to a file or directory. If
   * destPath points to a local file set `options.localDest` to true
   * @param {object} [options={}] remoteCopyOptions
   * @param {boolean} [options.localSrc = false] Set this option to true to copy
   * files from the local file system. Cannot be combined with localDest.
   * @param {boolean} [options.localDest = false] Set this option to true to
   * copy files to the local file system. Cannot be combined with localSrc.
   * @param {boolean} [options.override = false] set to true to override
   * existing files
   * @param {Function} [options.progressCallback] a function that will be called
   * every time the operation completes on a single file, a path to that file
   * will be passed as argument to the callback `progressCallback(path)`
   * @returns {Promise<Array<string>>} returns a promise resolving to an array
   * of copied file destination paths
   * @throws {FilesError}
   * @memberof Files
   */
  async copy (srcPath, destPath, options = {}) {
    // COPY REMOTE TO REMOTE
    const _copyRemoteToRemote = async (srcPath, destPath, options) => {
      srcPath = Files._normalizeRemotePath(srcPath)
      destPath = Files._normalizeRemotePath(destPath)

      const srcIsDirectory = Files._isRemoteDirectory(srcPath)
      const destIsDirectory = Files._isRemoteDirectory(destPath)

      if (destIsDirectory) destPath = Files._childRemotePath(destPath, srcPath)

      const srcFiles = await this.list(srcPath)
      if (srcFiles.length === 0) throw new FilesError(`remote src '${srcPath}' does not exist`, FilesError.codes.FileNotExists)
      if (!options.override && !(srcIsDirectory && !destIsDirectory) && (await this.list(destPath)).length > 0) throw new FilesError(`remote dest '${destPath}' exists and overrides are not allowed`, FilesError.codes.FileExistsNoOverrides)

      if (srcIsDirectory) {
        return Promise.all(srcFiles.map(async f => {
          // srcPath to keep relative sub folders to f
          const newDest = Files._childRemotePath(destPath, f, srcPath)
          await this._copyRemoteToRemoteFile(f, newDest, options)
          if (options.progressCallback) options.progressCallback(newDest)
          return newDest
        }))
      }
      // is file
      await this._copyRemoteToRemoteFile(srcPath, destPath, options)
      if (options.progressCallback) options.progressCallback(destPath)
      return [ destPath ]
    }

    // COPY REMOTE TO LOCAL
    const _copyRemoteToLocal = async (src, dest, options) => {
      const _downloadFile = async (srcPath, destPath) => {
        // this error should not happen
        /* istanbul ignore next */
        if (Files._isRemoteDirectory(srcPath)) throw new FilesError(`srcPath cannot be a directory.`, FilesError.codes.Internal)

        await fs.ensureDir(upath.dirname(destPath))

        let localDestStat
        try {
          localDestStat = await fs.stat(destPath)
        } catch (e) {
          if (e.code !== 'ENOENT') throw e // todo wrap error?
        }
        // this error should not happen
        /* istanbul ignore next */
        if (localDestStat && !localDestStat.isFile()) throw new FilesError(`destPath is invalid.`, FilesError.codes.Internal)
        return new Promise(async (resolve, reject) => {
          // download file
          const srcStream = await this.createReadStream(srcPath)
          const destStream = fs.createWriteStream(destPath)
          const stream = srcStream.pipe(destStream)
          stream.on('finish', () => resolve(destPath))
          stream.on('error', reject) // todo wrap error?
        })
      }

      // don't override args, we need to later check if dest ends with /
      let srcPath = Files._normalizeRemotePath(src)
      let destPath = upath.toUnix(upath.resolve(dest))

      const srcIsDirectory = Files._isRemoteDirectory(srcPath)
      const srcFiles = await this.list(srcPath)
      if (srcFiles.length === 0) throw new FilesError(`remote src '${srcPath}' does not exist`, FilesError.codes.FileNotExists)

      let destStats
      try {
        destStats = await fs.stat(destPath)
      } catch (e) {
        // if does not exists is fine
        if (e.code !== 'ENOENT') throw e // todo wrap error?
      }
      let destExists = !!destStats
      const destIsFile = destExists && destStats.isFile()
      const destIsDirectory = destExists && destStats.isDirectory()
      if (destExists && !destIsFile && !destIsDirectory) throw new FilesError(`local dest '${destPath}' exists but is not a valid file or directory`, FilesError.codes.BadFileType)
      if (srcIsDirectory && destIsFile) throw new FilesError(`local dest '${destPath}' is a file but remote src is a directory, cannot copy to file.`, FilesError.codes.BadFileType)

      if (destIsDirectory || (!destExists && dest.endsWith('/'))) {
        // change path to point within directory
        destPath = upath.toUnix(upath.join(destPath, upath.basename(srcPath)))
        // we need to recompute if exists
        destExists = await fs.pathExists(destPath)
      }

      if (!options.override && destExists) throw new FilesError(`local dest '${destPath}' exists and overrides are not allowed`, FilesError.codes.FileExistsNoOverrides)

      if (srcIsDirectory) {
        // src is a folder
        return Promise.all(srcFiles.map(async f => {
          // keep the folder structure under srcPath with relative
          const destFilePath = upath.toUnix(upath.join(destPath, upath.relative(srcPath, f)))
          await _downloadFile(f, destFilePath)
          if (options.progressCallback) options.progressCallback(destFilePath)
          return destFilePath
        }))
      }
      // src is a file
      await fs.ensureDir(upath.dirname(destPath))
      await _downloadFile(srcPath, destPath)
      if (options.progressCallback) options.progressCallback(destPath)
      return [destPath]
    }

    // COPY LOCAL TO REMOTE
    const _copyLocalToRemote = async (srcPath, destPath, options) => {
      const _uploadFile = async (srcPath, destPath) => {
        await this.write(destPath, fs.createReadStream(srcPath))
        return destPath
      }
      const _copy = async (srcPath, destPath, options, first = false) => {
        srcPath = upath.toUnix(srcPath)
        let stat
        try {
          stat = await fs.stat(srcPath)
        } catch (e) {
          if (e.code === 'ENOENT') throw new FilesError(`local src '${srcPath}' does not exist`, FilesError.codes.FileNotExists)
          throw e // todo wrap error
        }
        const srcIsDirectory = stat.isDirectory()
        const srcIsFile = stat.isFile()
        if (!srcIsFile && !srcIsDirectory) {
          // ignore symlinks during recursion but throw error if explicitly asking to upload symlink
          if (!first) return [null]
          throw new FilesError(`local src '${srcPath}' exists but is not a valid file nor directory`, FilesError.codes.BadFileType)
        }
        const destIsDirectory = Files._isRemoteDirectory(destPath)

        if (destIsDirectory) destPath = Files._childRemotePath(destPath, srcPath)

        if (!options.override && !(srcIsDirectory && !destIsDirectory) && (await this.list(destPath)).length > 0) throw new FilesError(`remote dest '${destPath}' exists and overrides are not allowed`, FilesError.codes.FileExistsNoOverrides)

        if (srcIsDirectory) {
          // src is directory
          const files = await fs.readdir(srcPath)
          const res = await Promise.all(files.map(async f => {
            const childDestPath = Files._childRemotePath(destPath, f)
            const fullPath = upath.toUnix(upath.join(srcPath, f))
            return _copy(fullPath, childDestPath, options)
          }))
          return res.reduce((prev, curr) => prev.concat(curr), [])
        }
        // src is file - recursion stops
        await _uploadFile(srcPath, destPath)
        if (options.progressCallback) options.progressCallback(destPath)
        return [destPath]
      }
      // back to _copyLocalToRemote
      srcPath = upath.toUnix(upath.resolve(srcPath))
      destPath = Files._normalizeRemotePath(destPath)
      // filter out nulls (can happen if symlink in folder)
      return (await _copy(srcPath, destPath, options, true)).filter(f => f !== null)
    }

    // COPY General
    validateFilePath(srcPath, 'srcPath')
    validateFilePath(destPath, 'destPath')
    validateInput(options, joi.object().keys({ override: joi.boolean(), localSrc: joi.boolean(), localDest: joi.boolean(), progressCallback: joi.func() }).oxor('localSrc', 'localDest').label('options').required())
    if (options.localDest) return _copyRemoteToLocal(srcPath, destPath, options)
    if (options.localSrc) return _copyLocalToRemote(srcPath, destPath, options)
    return _copyRemoteToRemote(srcPath, destPath, options)
  }
}

Files.publicPrefix = 'public'

module.exports = { Files }
