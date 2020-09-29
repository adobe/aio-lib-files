/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/
const joi = require('@hapi/joi')
const { Files, FilePermissions } = require('./Files')
const { codes, logAndThrow } = require('./FilesError')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

/**
 * Local TVM proxy to emulate functionality of TVM
 * @abstract
 * @class TVMWrapper
 * @classdesc Emulates TVM
 */
class TVMWrapper {

  /**
   * Initializes and returns a new TVMWrapper instance
   *
   * @param {boolean} _isTest set this to true to allow construction
   * @memberof TVMWrapper
   * @abstract
   * @private
   */
  constructor (_isTest) {
    if (new.target === TVMWrapper && !_isTest) throwNotImplemented('TVMWrapper')
  }

  /**
   * @static
   * @param {object} credentials abstract credentials
   * @returns {Promise<TVMWrapper>} a new TVMWrapper instance
   * @memberof TVMWrapper
   * @abstract
   * @private
   */
  static async init (credentials) {
    throwNotImplemented('init')
  }

  async getAzureBlobCredentials() {
    throwNotImplemented('getAzureBlobCredentials')
  }

  async getAzureBlobPresignCredentials(presignOptions) {
    throwNotImplemented('getAzureBlobPresignCredentials')
  }

}

// eslint-disable-next-line jsdoc/require-jsdoc
function throwNotImplemented (funcName) {
  logAndThrow(new codes.ERROR_NOT_IMPLEMENTED({ messageValues: [funcName] }))
}

module.exports = { TVMWrapper }
