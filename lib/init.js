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

const TvmClient = require('@adobe/aio-lib-core-tvm')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

const utils = require('./utils')
const { AzureBlobFiles } = require('./impl/AzureBlobFiles')
const { Files, FilePermissions, UrlType } = require('./Files')

require('./types.jsdoc') // for VS Code autocomplete
/* global OpenWhiskCredentials, AzureCredentialsAccount, AzureCredentialsSAS */ // for linter

/**
 * Initializes and returns the cloud files SDK.
 *
 * To use the SDK you must either provide provide your
 * [OpenWhisk credentials]{@link OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure blob storage credentials]{@link AzureCredentialsAccount} in `credentials.azure`.
 *
 * OpenWhisk credentials can also be read from environment variables (`__OW_NAMESPACE` and `__OW_API_KEY`).
 *
 * @param {object} [config={}] configuration used to init the sdk
 *
 * @param {OpenWhiskCredentials} [config.ow]
 * {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 *
 * @param {AzureCredentialsAccount|AzureCredentialsSAS} [config.azure]
 * bring your own [Azure SAS credentials]{@link AzureCredentialsSAS} or
 * [Azure storage account credentials]{@link AzureCredentialsAccount}
 *
 * @param {object} [config.tvm] tvm configuration, applies only when passing OpenWhisk credentials
 * @param {string} [config.tvm.apiUrl] alternative tvm api url.
 * @param {string} [config.tvm.cacheFile] alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns {Promise<Files>} A Files instance
 */
async function init (config = {}) {
  // todo joi-validate config here or leave it to Files impl + TvmClient?
  // 0. log
  const logConfig = utils.withHiddenFields(config, ['ow.auth', 'azure.sasURLPrivate', 'azure.sasURLPublic', 'azure.storageAccessKey'])

  logger.debug(`init with config: ${JSON.stringify(logConfig, null, 2)}`)

  // 1. set provider
  const provider = 'azure' // only azure is supported for now

  // 2. instantiate tvm
  let tvm
  /* istanbul ignore else */
  if (provider === 'azure') {
    logger.debug('init with openwhisk credentials.')
    // remember config.ow can be empty if env vars are set
    const tvmArgs = { ow: config.ow, ...config.tvm }
    tvm = await TvmClient.init(tvmArgs)
  }

  // 3. return state store based on provider
  switch (provider) {
    case 'azure':
      if (config.azure) {
        logger.debug('init with azure blob credentials.')
        return AzureBlobFiles.init(config.azure, tvm)
      }
      return AzureBlobFiles.init(await utils.wrapTVMRequest(tvm.getAzureBlobCredentials()), tvm)
    // default:
    //   throw new FilesError(`provider '${provider}' is not supported.`, FilesError.codes.BadArgument)
  }
}

module.exports = { init, FilePermissions, UrlType }
