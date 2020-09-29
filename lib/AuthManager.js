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

const TvmClient = require('@adobe/aio-lib-core-tvm')
const { AzureTVMWrapper } = require('./impl/AzureTVMWrapper')
const utils = require('./utils')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

/**
 * Provides creds either from remote or local TVM
 * @class AuthManager
 * @classdesc proxy to local or remote TVM
 */
class AuthManager {

  /**
   * [INTERNAL] Creates an instance of AuthManager. Use static init instead.
   *
   * @param {TVMClient} remoteTVM tvm client instance
   * @param {TVMWrapper} localTVM TVMWrapper instance
   * @memberof AuthManager
   * @private
   */
  constructor(remoteTVM, localTVM) {
    this.remoteTVM = remoteTVM
    this.localTVM = localTVM
  }

  /**
   * Creates and return an instance of AuthManager
   * @static
   * @param {object} credentials abstract credentials
   * @returns {Promise<Files>} a new Files instance
   * @memberof Files
   * @abstract
   * @private
   */
  static async init (config, provider) {
    /* istanbul ignore else */
    if (provider === 'azure') {
      logger.debug('init with openwhisk credentials.')
      // remember config.ow can be empty if env vars are set
      const tvmArgs = { ow: config.ow, ...config.tvm }
      const remoteTVM = await TvmClient.init(tvmArgs)

      let localTVM
      if (config.azure) {
        logger.debug('init with azure blob credentials.')
        localTVM = await AzureTVMWrapper.init(config.azure)
      }

      const authMgr = new AuthManager(remoteTVM, localTVM)
      return authMgr
    }
  }

  async getAzureBlobCredentials() {
    let creds
    if(this.localTVM !== undefined) {
      creds = await this.localTVM.getAzureBlobCredentials()
      creds.sasCreds = false
    } else {
      creds = await utils.wrapTVMRequest(this.remoteTVM.getAzureBlobCredentials())
      creds.sasCreds = true
    }
    return creds
  }

  async getAzureBlobPresignCredentials(presignOptions) {
    if(this.localTVM !== undefined) {
      return await this.localTVM.getAzureBlobPresignCredentials(presignOptions)
    } else {
      return await utils.wrapTVMRequest(this.remoteTVM.getAzureBlobPresignCredentials(presignOptions))
    }
  }

}

module.exports = { AuthManager }
