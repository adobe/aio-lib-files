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
 * @typedef StorageErrorCode
 * @type {string}
 */

/**
 * A custom error class for errors thrown from the cloud storage module
 *
 * @class StorageError
 * @augments Error
 */
class StorageError extends Error {
  /**
   * Creates an instance of StorageError.
   *
   * @param {string} message error message
   * @param {StorageErrorCode} code Storage Error code
   * @param {object} internal debug error object for internal/underlying wrapped errors
   * @memberof StorageError
   */
  constructor (message, code, internal) {
    code = StorageError.codes[code] ? code : StorageError.codes.Internal
    message = `[${code}] ${message}`
    super(message)
    this.name = 'StorageError'// this.constructor.name
    this.code = code
    this.internal = internal
  }
}

// todo jsdoc codes, this breaks generation
/**
 * @type {object} codes
 * @property {StorageErrorCode} Internal
 * @property {StorageErrorCode} BadArgument
 * @property {StorageErrorCode} Forbidden
 * @property {StorageErrorCode} FileNotExists
 * @property {StorageErrorCode} FileExistsNoOverrides
 * @property {StorageErrorCode} BadFileType
 */
StorageError.codes = {
  // general (make a super class?)
  Internal: 'Internal',
  NotImplemented: 'NotImplemented',
  BadArgument: 'BadArgument',
  Forbidden: 'Forbidden',

  // specific to AIOStorageSDK
  FileNotExists: 'FileNotExists',
  FileExistsNoOverrides: 'FileExistsNoOverrides',
  BadFileType: 'BadFileType'
}

module.exports = { StorageError }
