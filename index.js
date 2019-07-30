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

// hardcoded default tvm
// TODO those are temporary, change to adobeio + expose proper api
const DEFAULT_TVM_API_URL = 'https://adobeioruntime.net/api/v1/web/mraho/adobeio-cna-token-vending-machine-0.1.0'

/**
 * Initilizes and returns the storage SDK.
 *
 * To use the SDK you must either provide your own credentials in `config.credentials`
 * or provide your OpenWhisk credentials in `config.ow`.
 *
 * @param {object} config configuration to init the sdk
 *
 * @param {object} [config.credentials] bring your own storage credentials
 *
 * @param {object} [config.ow] OpenWhisk credentials
 * @param {string} [config.ow.namespace] OpenWhisk namespace, can also be passed
 *   in an environment variable `OW_NAMESPACE` or `__OW_NAMESPACE`
 * @param {string} [config.ow.auth] OpenWhisk auth, can also be passed
 *   in an environment variable `OW_AUTH` or `__OW_AUTH`
 *
 * @param {object} [options={}] options
 * @param {string} [options.tvmApiUrl] if different than default
 * @param {string} [options.tvmCacheFile] cache the tvm credentials to a file
 * @param {string} [options.provider='azure'] for now only 'azure' is supported
 * @returns {Promise<Storage>} A storage instance
 */
async function init (config, options = {}) {
  // include ow environment vars to config
  const namespace = process.env['__OW_NAMESPACE'] || process.env['OW_NAMESPACE']
  const auth = process.env['__OW_AUTH'] || process.env['OW_AUTH']
  if (namespace || auth) {
    if (typeof config !== 'object') {
      config = {}
    }
    if (typeof config.ow !== 'object') {
      config.ow = {}
    }
    config.ow.namespace = config.ow.namespace || namespace
    config.ow.auth = config.ow.auth || auth
  }

  return _init(config, options)
}

// eslint-disable-next-line jsdoc/require-jsdoc
async function _init (config, options = {}) {
  const validation = joi.validate(config, joi.object().label('config').keys({
    credentials: joi.object(),
    ow: joi.object().keys({
      namespace: joi.string().required(),
      auth: joi.string().required()
    })
  }).unknown().xor('ow', 'credentials').required())
  if (validation.error) throw new StorageError(validation.error.message, StorageError.codes.BadArgument)

  // 1. set provider
  const provider = options.provider || 'azure'
  if (provider !== 'azure') throw new StorageError(`provider '${provider}' is not supported.`, StorageError.codes.BadArgument)

  // 2. get tvm if no credentials
  let tvm
  if (!config.credentials) {
    // default tvm url
    if (!options.tvmApiUrl) options.tvmApiUrl = DEFAULT_TVM_API_URL
    tvm = new TvmClient({ ow: config.ow, apiUrl: options.tvmApiUrl, cacheFile: options.tvmCacheFile })
  }

  // 3. return storage based on provider
  switch (provider) {
    case 'azure':
      const credentials = config.credentials ? config.credentials : (await tvm.getAzureBlobCredentials())
      return AzureStorage.init(credentials)
    default:
      throw new StorageError(`provider '${config.provider}' is not supported.`, StorageError.codes.BadArgument)
  }
}

module.exports = { init }
