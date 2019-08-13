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
const fs = require('fs-extra')
const request = require('request-promise')
const path = require('path')
const tmp = require('os').tmpdir()

/* istanbul ignore next */
/**
 * Joins url path parts
 *
 * @param {...string} args url parts
 * @returns {string} joined url
 * @private
 */
function urlJoin (...args) {
  let start = ''
  if (args[0] && args[0].startsWith('/')) start = '/'
  return start + args.map(a => a && a.replace(/(^\/|\/$)/g, '')).filter(a => a).join('/')
}

/**
 * @class TvmClient
 * @classdesc Client SDK for Token Vending Machine (TVM)
 * @hideconstructor
 * @private
 */
class TvmClient {
  /**
   * @param  {object} config TvmClientParams
   * @param  {string} config.apiUrl url to tvm api
   * @param  {module:types~OpenWhiskCredentials} config.ow Openwhisk credentials
   * @param  {string} [config.cacheFile] if omitted defaults to
   * tmpdir/.tvmCache, use false or null to not cache
   * @private
   */
  constructor (config) {
    const res = joi.validate(config, joi.object().label('config').keys({
      ow: joi.object().keys({
        namespace: joi.string().required(),
        auth: joi.string().required()
      }).required(),
      apiUrl: joi.string().uri().required(),
      cacheFile: joi.any()
    }).unknown().required())
    if (res.error) throw res.error

    this.ow = config.ow
    this.apiUrl = config.apiUrl

    if (config.cacheFile === undefined) config.cacheFile = TvmClient.DefaultTVMCacheFile
    if (config.cacheFile) {
      this.cacheFile = config.cacheFile
    }
  }
  async _getCredentialsFromTVM (url) {
    // todo wrap potential errors (i.e. unauthorized) into a custom error
    return request(url, {
      json: {
        owNamespace: this.ow.namespace,
        owAuth: this.ow.auth
      }
    })
  }

  async _cacheCredentialsToFile (cacheKey, creds) {
    if (!this.cacheFile) return null

    let allCreds
    try {
      const content = (await fs.readFile(this.cacheFile)).toString()
      allCreds = JSON.parse(content)
    } catch (e) {
      allCreds = {} // cache file does not exist or is invalid
    }

    // need to store by ow.namespace in case user changes ow.namespace in config
    allCreds[cacheKey] = creds
    await fs.writeFile(this.cacheFile, JSON.stringify(allCreds))

    return true
  }

  async _getCredentialsFromCacheFile (cacheKey) {
    if (!this.cacheFile) return null

    let creds
    try {
      const content = (await fs.readFile(this.cacheFile)).toString()
      creds = JSON.parse(content)[cacheKey]
    } catch (e) {
      return null // cache file does not exist or is invalid
    }
    if (!creds) return null // credentials for ow.namespace do not exist
    // give a minute less to account for the usage time
    if (Date.now() > (Date.parse(creds.expiration) - 60000)) return null
    return creds
  }

  /**
   * Reads the credentials from the TVM or cache
   *
   * @param {string} endpoint - TVM API endpoint
   * @private
   * @returns {Promise<object>} credentials for service
   */
  async _getCredentials (endpoint) {
    const fullUrl = urlJoin(this.apiUrl, endpoint)
    const cacheKey = `${this.ow.namespace}-${fullUrl}`

    let creds = await this._getCredentialsFromCacheFile(cacheKey)
    if (!creds) {
      creds = await this._getCredentialsFromTVM(fullUrl)
      await this._cacheCredentialsToFile(cacheKey, creds)
    }
    return creds
  }

  // todo this should not be marked as private, but until it's not in its own module we hide it from the jsdoc
  /**
   * Reads the credentials for Azure blob storage from the TVM or cache
   *
   * @returns {Promise<object>} credentials for service
   * @private
   */
  async getAzureBlobCredentials () { return this._getCredentials(TvmClient.AzureBlobEndpoint) }

  // async getS3Credentials () { return this._getCredentials(TvmClient.AwsS3Endpoint) }
}

// todo change backend endpoints to smthg more readable (e.g. /storage, /kv .. )
TvmClient.AzureBlobEndpoint = 'get-azure-blob-token'
// TvmClient.AwsS3Endpoint = 'get-s3-upload-token'

TvmClient.DefaultTVMCacheFile = path.join(path.join(tmp, '.tvmCache'))

module.exports = { TvmClient }
