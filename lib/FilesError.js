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

/**
 * @class FilesError
 * @classdesc Cloud Files Errors
 * @hideconstructor
 * @augments Error
 */
class FilesError extends Error {
  /**
   * Creates an instance of FilesError.
   *
   * @param {string} message error message
   * @param {FilesError.codes} code Cloud Files Error code
   * @param {object} [internal] debug error object for internal/underlying wrapped errors
   * @memberof FilesError
   */
  constructor (message, code, internal) {
    /* istanbul ignore next */
    code = FilesError.codes[code] ? code : FilesError.codes.Internal
    message = `[${code}] ${message}`
    super(message)
    this.name = 'FilesError'
    this.code = code
    this.internal = internal
  }
}

/**
 * @enum {string} FilesError codes
 */
FilesError.codes = {
  // general (make a super class?)
  Internal: 'Internal',
  NotImplemented: 'NotImplemented',
  BadArgument: 'BadArgument',
  Forbidden: 'Forbidden',

  // specific to files lib
  FileNotExists: 'FileNotExists',
  BadFileType: 'BadFileType'
}

module.exports = { FilesError }
