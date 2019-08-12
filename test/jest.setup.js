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
const { StorageError } = require('../lib/StorageError')

process.on('unhandledRejection', error => {
  throw error
})

async function toThrowWithCodeAndMessageContains (received, code, words, checkErrorType = true) {
  function checkErrorCode (e, code) {
    if (!(e instanceof StorageError)) {
      return { message: () => `expected error to be instanceof "StorageError", instead received "${e.constructor.name}" with message: "${e.message}"`, pass: false }
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
  toThrowBadArgWithMessageContaining: (received, words, checkErrorType = true) => toThrowWithCodeAndMessageContains(received, StorageError.codes.BadArgument, words, checkErrorType),
  toThrowForbidden: (received) => toThrowWithCodeAndMessageContains(received, StorageError.codes.Forbidden, ['forbidden', 'credentials']),
  toThrowInternalWithStatus: (received, status) => toThrowWithCodeAndMessageContains(received, StorageError.codes.Internal, ['' + status, 'unknown']),
  toThrowInternal: (received) => toThrowWithCodeAndMessageContains(received, StorageError.codes.Internal, ['unknown']),
  toThrowFileNotExists: (received, filePath) => toThrowWithCodeAndMessageContains(received, StorageError.codes.FileNotExists, ['file', 'not exist', filePath]),
  toThrowBadArgDirectory: (received, filePath) => toThrowWithCodeAndMessageContains(received, StorageError.codes.BadArgument, ['file', 'directory', filePath]),
  toThrowFileExistsNoOverride: (received) => toThrowWithCodeAndMessageContains(received, StorageError.codes.FileExistsNoOverrides, ['override']),
  toThrowBadFileType: (received, filePath) => toThrowWithCodeAndMessageContains(received, StorageError.codes.BadFileType, [filePath] || [])
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
  f = upath.relative(process.cwd(), f)
  let traverse = fakeFs.files
  const parts = f.split('/')
  for (let i = 0; i < parts.length; ++i) {
    if (traverse[parts[i]] !== undefined) traverse = traverse[parts[i]]
    else fakeFs._throw('ENOENT')
  }
  return traverse
}
fakeFs.addFile = (fpath, content = '') => {
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
fakeFs.stat = async f => (typeof fakeFs._find(f) === 'object') ? { isFile: () => false, isDirectory: () => true } : { isFile: () => true, isDirectory: () => false }
fakeFs.pathExists = async f => {
  try {
    fakeFs._find(f)
    return true
  } catch (e) {
    if (e.code === 'ENOENT') return false
    else throw e
  }
}
fakeFs.readdir = async f => {
  const traverse = fakeFs._find(f)
  if (typeof traverse !== 'object') {
    fakeFs._throw('ENOTDIR')
  }
  return Object.keys(traverse)
}
fakeFs.createReadStream = f => {
  const traverse = fakeFs._find(f)
  if (typeof traverse === 'object') {
    fakeFs._throw('EISDIR')
  }
  return global.createStream(traverse)
}
global.fakeFs = () => fakeFs
