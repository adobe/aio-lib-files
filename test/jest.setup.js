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

/* eslint-disable jsdoc/require-jsdoc */
const { FilesError } = require('../lib/FilesError')

process.on('unhandledRejection', error => {
  throw error
})

async function toThrowWithCodeAndMessageContains (received, code, words, checkErrorType = true) {
  function checkErrorCode (e, code) {
    if (!(e instanceof FilesError)) {
      return { message: () => `expected error to be instanceof "FilesError", instead received "${e.constructor.name}" with message: "${e.message}"`, pass: false }
    }
    if (e.code !== code) {
      return { message: () => `expected error code to be "${code}", instead received "${e.code}" with message: "${e.message}"`, pass: false }
    }
  }
  function checkErrorMessageContains (message, words) {
    message = message.toLowerCase()
    if (typeof words === 'string') words = [words]
    for (let i = 0; i < words.length; ++i) {
      let a = words[i].toLowerCase()
      if (message.indexOf(a) < 0) {
        return { message: () => `expected error message "${message}" to contain "${a}"`, pass: false }
      }
    }
  }
  try {
    await received()
  } catch (e) {
    if (checkErrorType) {
      const res = checkErrorCode(e, code)
      if (res) return res
    }
    const res = checkErrorMessageContains(e.message, words)
    if (res) return res
    return { pass: true }
  }
  return { message: () => 'function should have thrown', pass: false }
}
expect.extend({
  toThrowWithCodeAndMessageContains,
  toThrowBadArgWithMessageContaining: (received, words, checkErrorType = true) => toThrowWithCodeAndMessageContains(received, FilesError.codes.BadArgument, words, checkErrorType),
  toThrowForbidden: (received) => toThrowWithCodeAndMessageContains(received, FilesError.codes.Forbidden, ['forbidden', 'credentials']),
  toThrowInternalWithStatus: (received, status) => toThrowWithCodeAndMessageContains(received, FilesError.codes.Internal, ['' + status, 'unknown']),
  toThrowInternal: (received) => toThrowWithCodeAndMessageContains(received, FilesError.codes.Internal, ['unknown']),
  toThrowFileNotExists: (received, filePath) => toThrowWithCodeAndMessageContains(received, FilesError.codes.FileNotExists, ['file', 'not exist', filePath]),
  toThrowBadArgDirectory: (received, filePath) => toThrowWithCodeAndMessageContains(received, FilesError.codes.BadArgument, ['file', 'directory', filePath]),
  toThrowBadFileType: (received, filePath) => toThrowWithCodeAndMessageContains(received, FilesError.codes.BadFileType, [filePath] || []),
  toThrowNotImplemented: (received, methodName) => toThrowWithCodeAndMessageContains(received, FilesError.codes.NotImplemented, ['not implemented', methodName])
})
const stream = require('stream')
global.createStream = (content) => {
  const rdStream = new stream.Readable()
  rdStream.push(content)
  rdStream.push(null)
  return rdStream
}

// Fake FS, in house only a few features needed to test storage.copy
const upath = require('upath')
const fakeFs = { files: {} }
fakeFs.reset = () => { fakeFs.files = {} }
fakeFs.set = files => { fakeFs.files = files }
fakeFs._throw = code => {
  const e = new Error(code)
  e.code = code
  throw e
}
fakeFs._find = f => {
  // make sure to remove resolves
  f = upath.toUnix(upath.relative(process.cwd(), f))
  let traverse = fakeFs.files
  const parts = f.split('/')
  for (let i = 0; i < parts.length; ++i) {
    if (traverse[parts[i]] !== undefined) traverse = traverse[parts[i]]
    else fakeFs._throw('ENOENT')
  }
  return traverse
}
fakeFs._statFound = async found => {
  if (typeof found === 'object') {
    return { isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false }
  }
  if (found === 'SYMLINK') {
    return { isFile: () => false, isDirectory: () => false, isSymbolicLink: () => true }
  }
  return { isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false }
}
fakeFs.addFile = (fpath, content = '') => {
  fpath = upath.toUnix(fpath)
  const filename = upath.basename(fpath)
  const dirname = upath.dirname(fpath)
  let traverse = fakeFs.files
  if (dirname !== '.') {
    dirname.split('/').forEach(dir => {
      if (!traverse[dir]) traverse[dir] = {}
      if (typeof traverse[dir] !== 'object') {
        throw new Error(`cannot add dir on file ${dir}`)
      }
      traverse = traverse[dir]
    })
  }
  traverse[filename] = content
}
fakeFs.stat = async f => {
  const found = fakeFs._find(f)
  if (found instanceof Error) {
    throw found
  }
  return fakeFs._statFound(found)
}
fakeFs.pathExists = async f => {
  try {
    fakeFs._find(f)
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    else throw e
  }
}
fakeFs.readdir = async (f, options) => {
  const traverse = fakeFs._find(f)
  if (typeof traverse !== 'object') {
    fakeFs._throw('ENOTDIR')
  }
  const keys = Object.keys(traverse)
  if (options.withFileTypes) {
    const withTypes = await Promise.all(keys.map(async k => ({ name: k, ...(await fakeFs._statFound(traverse[k])) })))
    return withTypes
  }
  return keys
}
fakeFs.createReadStream = f => {
  const traverse = fakeFs._find(f)
  if (typeof traverse === 'object') {
    fakeFs._throw('EISDIR')
  }
  return global.createStream(traverse)
}
global.fakeFs = () => fakeFs
