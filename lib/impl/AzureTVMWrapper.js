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

const azure = require('@azure/storage-blob')
const joi = require('@hapi/joi')
const { TVMWrapper } = require('../TVMWrapper')
const { codes, logAndThrow } = require('./FilesError')
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: 'debug' })

/**
 * Creates a container if it does not exist
 *
 * @param {azure.ContainerURL} containerURL azure ContainerUrl
 * @param {azure.Aborter} aborter azure Aborter
 * @param {boolean} [isPublic=false] set to true to create a public container
 * @private
 */
async function createContainerIfNotExists (containerURL, aborter, isPublic = false) {
  try {
    logger.debug(`creating ${isPublic ? 'public' : 'private'} azure blob container`)
    await containerURL.create(aborter, isPublic ? { access: 'blob' } : {})
  } catch (e) {
    // bug in the past where randomly switch from Code to code.. weird
    if (!(typeof e.body === 'object' && (e.body.Code === 'ContainerAlreadyExists' || e.body.code === 'ContainerAlreadyExists'))) throw e
    logger.debug(`${isPublic ? 'public' : 'private'} azure blob container already exists`)
  }
}

/**
 * Local TVM proxy to emulate Azure based functionality of TVM
 * @class AzureTVMWrapper
 * @classdesc Local TVM Implementation on top of Azure Blob
 * @augments LocalTVM
 * @hideconstructor
 * @private
 */
class AzureTVMWrapper extends TVMWrapper {

  /**
   * [INTERNAL] Creates an instance of AzureTVMWrapper. Use static init instead.
   *
   * @param {AzureCredentials} credentials {@link AzureCredentials}
   * @memberof AzureTVMWrapper
   * @private
   */
  constructor (credentials) {
    super()
    this.credentials = credentials
    const res = joi.object().label('credentials').keys({
      storageAccessKey: joi.string(),
      storageAccount: joi.string(),
      containerName: joi.string()
    }).required().unknown().and('storageAccount', 'storageAccessKey', 'containerName')
      .validate(credentials)
    if (res.error) {
      logAndThrow(new codes.ERROR_BAD_ARGUMENT({ messageValues: [res.error.message], sdkDetails: cloned }))
    }
  }

  /**
   * Creates and return an instance of AzureTVMWrapper
   *
   * @static
   * @param {AzureCredentials} credentials {@link AzureCredentials}
   * @returns {Promise<AzureTVMWrapper>} new instance
   * @memberof AzureTVMWrapper
   */
  static async init (credentials) {
    return new AzureTVMWrapper(credentials)
  }

  async getAzureBlobCredentials() {
    const azureCreds = new azure.SharedKeyCredential(this.credentials.storageAccount, this.credentials.storageAccessKey)
    const pipeline = azure.StorageURL.newPipeline(azureCreds)
    const serviceURL = new azure.ServiceURL(`https://${this.credentials.storageAccount}.blob.core.windows.net/`, pipeline)
    const privateSASURL = azure.ContainerURL.fromServiceURL(serviceURL, this.credentials.containerName + '')
    const publicSASURL = azure.ContainerURL.fromServiceURL(serviceURL, this.credentials.containerName + '-public')

    const errorDetails = { containerName: this.credentials.containerName, storageAccount: this.credentials.storageAccount }
    await createContainerIfNotExists(privateSASURL, azure.Aborter.none)
    await createContainerIfNotExists(publicSASURL, azure.Aborter.none, true)

    return {
      sasURLPrivate: privateSASURL,
      sasURLPublic: publicSASURL
    }
  }

  async getAzureBlobPresignCredentials(params) {
    const sharedKeyCredential = new azure.SharedKeyCredential(this.credentials.storageAccount, this.credentials.storageAccessKey)
    const containerName = this.credentials.containerName
    // generate SAS token
    const expiryTime = new Date(Date.now() + (1000 * params.expiryInSeconds))
    const perm = (params.permissions === undefined) ? 'r' : params.permissions
    const permissions = azure.BlobSASPermissions.parse(perm)
    const commonSasParams = {
      permissions: permissions.toString(),
      expiryTime: expiryTime,
      blobName: params.blobName
    }

    const sasQueryParamsPrivate = azure.generateBlobSASQueryParameters({ ...commonSasParams, containerName: containerName }, sharedKeyCredential)
    return {
      signature: sasQueryParamsPrivate.toString()
    }
  }

}

module.exports = { AzureTVMWrapper }
