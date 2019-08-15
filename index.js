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
const joi = require('@hapi/joi')

const { AzureStorage } = require('./lib/azure/AzureStorage')
const { StorageError } = require('./lib/StorageError')
const { Storage } = require('./lib/Storage')
const { TvmClient } = require('./lib/TvmClient')

// Adobe I/O default token-vending-machine api host
const _defaultTvmApiUrl = 'https://adobeio.adobeioruntime.net/apis/tvm/'

// eslint-disable-next-line jsdoc/require-jsdoc
async function wrapTVMRequest (tvm) {
  // TODO wrap tvm errors in TvmClient with specific error codes
  // do this when tvm client has its own module
  try {
    const res = await tvm.getAzureBlobCredentials()
    return res
  } catch (e) {
    if (e.statusCode) {
      if (e.statusCode === 401 || e.statusCode === 403) {
        throw new StorageError('request to token vending machine (TVM) is forbidden, please check your OpenWhisk credentials', StorageError.codes.Forbidden)
      } else {
        throw new StorageError(`request to token vending machine (TVM) returned with an unknown error and status code ${e.statusCode}`, StorageError.codes.Internal, e)
      }
    } else {
      throw new StorageError(`request to token vending machine (TVM) returned with an unknown error`, StorageError.codes.Internal, e)
    }
  }
}

/**
 * Initializes and returns the storage SDK.
 *
 * To use the SDK you must either provide provide your
 * [OpenWhisk credentials]{@link module:types~OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure storage credentials]{@link module:types~AzureCredentialsAccount} in `credentials.azure`.
 *
 * OpenWhisk credentials can also be read from environment variables (`OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`).
 *
 * @param {object} credentials used to init the sdk
 *
 * @param {module:types~OpenWhiskCredentials} [credentials.ow]
 * {@link module:types~OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access our storage infrastructure. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`
 *
 * @param {module:types~AzureCredentialsAccount|module:types~AzureCredentialsSAS} [credentials.azure]
 * bring your own [Azure SAS credentials]{@link module:types~AzureCredentialsSAS} or
 * [Azure storage account credentials]{@link module:types~AzureCredentialsAccount}
 *
 * @param {object} [options={}] options
 * @param {string} [options.tvmApiUrl] alternative tvm api url. Only makes
 * sense in the context of OpenWhisk credentials.
 * @param {string} [options.tvmCacheFile] alternative tvm cache file, defaults
 * to `<tmpfolder>/.tvmCache`. Set to `false` to disable caching. Only makes
 * sense in the context of OpenWhisk credentials.
 * @returns {Promise<Storage>} A storage instance
 * @throws {StorageError}
 */
async function init (credentials, options = {}) {
  // todo in tvm client?
  // include ow environment vars to credentials
  const namespace = process.env['__OW_NAMESPACE'] || process.env['OW_NAMESPACE']
  const auth = process.env['__OW_AUTH'] || process.env['OW_AUTH']
  if (namespace || auth) {
    if (typeof credentials !== 'object') {
      credentials = {}
    }
    if (typeof credentials.ow !== 'object') {
      credentials.ow = {}
    }
    credentials.ow.namespace = credentials.ow.namespace || namespace
    credentials.ow.auth = credentials.ow.auth || auth
  }

  return _init(credentials, options)
}

// eslint-disable-next-line jsdoc/require-jsdoc
async function _init (credentials, options) {
  const validation = joi.validate(credentials, joi.object().label('credentials').keys({
    azure: joi.object().keys({
      // either
      sasURLPrivate: joi.string().uri(),
      sasURLPublic: joi.string().uri(),
      // or
      storageAccessKey: joi.string(),
      storageAccount: joi.string(),
      containerName: joi.string()
    }).unknown().and('storageAccount', 'storageAccessKey', 'containerName').and('sasURLPrivate', 'sasURLPublic').xor('sasURLPrivate', 'storageAccount'),
    ow: joi.object().keys({
      namespace: joi.string().required(),
      auth: joi.string().required()
    })
  }).unknown().xor('ow', 'azure').required())
  if (validation.error) throw new StorageError(validation.error.message, StorageError.codes.BadArgument)

  // 1. set provider
  const provider = 'azure' // only azure is supported for now

  // 2. instantiate tvm if ow credentials
  let tvm
  if (credentials.ow && !credentials.azure) {
    // default tvm url
    const tvmArgs = { ow: credentials.ow, apiUrl: options.tvmApiUrl || _defaultTvmApiUrl }
    if (options.tvmCacheFile) tvmArgs.cacheFile = options.tvmCacheFile
    tvm = new TvmClient(tvmArgs)
  }

  // 3. return storage based on provider
  switch (provider) {
    case 'azure':
      return AzureStorage.init(credentials.azure || (await wrapTVMRequest(tvm)))
    // default:
    //   throw new StorageError(`provider '${provider}' is not supported.`, StorageError.codes.BadArgument)
  }
}

module.exports = { init, _defaultTvmApiUrl }
