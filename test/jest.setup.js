/* eslint-disable jsdoc/require-jsdoc */
const { StorageError } = require('../lib/StorageError')

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
  toThrowBadArgDirectory: (received, filePath) => toThrowWithCodeAndMessageContains(received, StorageError.codes.BadArgument, ['file', 'directory', filePath])
})
