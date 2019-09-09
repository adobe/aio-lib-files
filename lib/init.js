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

const { AzureBlobFiles } = require('./impl/AzureBlobFiles')
const { FilesError } = require('./FilesError')
const { Files } = require('./Files')
const TvmClient = require('@adobe/aio-lib-tvm')

// eslint-disable-next-line jsdoc/require-jsdoc
async function wrapTVMRequest (promise) {
  return promise
    .catch(e => {
      if (e.status === 401 || e.status === 403) {
        throw new FilesError(`forbidden access to TVM, make sure your ow credentials are valid`, FilesError.codes.Forbidden)
      }
      throw e // throw raw tvm error
    })
}

/**
 * Initializes and returns the cloud files SDK.
 *
 * To use the SDK you must either provide provide your
 * [OpenWhisk credentials]{@link module:types~OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure blob storage credentials]{@link module:types~AzureCredentialsAccount} in `credentials.azure`.
 *
 * OpenWhisk credentials can also be read from environment variables (`__OW_NAMESPACE` and `__OW_AUTH`).
 *
 * @param {object} [config={}] configuration used to init the sdk
 *
 * @param {module:types~OpenWhiskCredentials} [config.ow]
 * {@link module:types~OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_AUTH`
 *
 * @param {module:types~AzureCredentialsAccount|module:types~AzureCredentialsSAS} [config.azure]
 * bring your own [Azure SAS credentials]{@link module:types~AzureCredentialsSAS} or
 * [Azure storage account credentials]{@link module:types~AzureCredentialsAccount}
 *
 * @param {object} [config.tvm] tvm configuration, applies only when passing OpenWhisk credentials
 * @param {string} [config.tvm.apiUrl] alternative tvm api url.
 * @param {string} [config.tvm.cacheFile] alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns {Promise<Files>} A Files instance
 * @throws {FilesError}
 */
async function init (config = {}) {
  // todo joi-validate config here or leave it to Files impl + TvmClient?

  // 1. set provider
  const provider = 'azure' // only azure is supported for now

  // 2. instantiate tvm if ow credentials
  let tvm
  if (provider === 'azure' && !config.azure) {
    // remember config.ow can be empty if env vars are set
    const tvmArgs = { ow: config.ow, ...config.tvm }
    tvm = await TvmClient.init(tvmArgs)
  }

  // 3. return state store based on provider
  switch (provider) {
    case 'azure':
      return AzureBlobFiles.init(config.azure || (await wrapTVMRequest(tvm.getAzureBlobCredentials())))
    // default:
    //   throw new FilesError(`provider '${provider}' is not supported.`, FilesError.codes.BadArgument)
  }
}

module.exports = { init }