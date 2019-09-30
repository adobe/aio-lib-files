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

const filesLib = require('../index')

const { AzureBlobFiles } = require('../lib/impl/AzureBlobFiles')
jest.mock('../lib/impl/AzureBlobFiles.js')

const TvmClient = require('@adobe/aio-lib-core-tvm')
jest.mock('@adobe/aio-lib-core-tvm')

beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

describe('init', () => {
  /* Common setup for init tests */
  beforeEach(async () => {
    AzureBlobFiles.mockRestore()
    AzureBlobFiles.init = jest.fn()
  })

  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('when passing azure credentials (owned by user)', () => {
    const fakeAzureBlobConfig = {
      fake: 'azureblobconfig',
      // to be hidden
      sasURLPrivate: 'https://fakessasprivate?secret',
      sasURLPublic: 'https://fakesaspublic?secret',
      storageAccessKey: 'fakestorageaccesskey'
    }
    test('with azure config', async () => {
      await filesLib.init({ azure: fakeAzureBlobConfig })
      expect(AzureBlobFiles.init).toHaveBeenCalledTimes(1)
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeAzureBlobConfig)
      expect(TvmClient.init).toHaveBeenCalledTimes(0)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('azure'))
      checkInitDebugLogNoSecrets(fakeAzureBlobConfig.storageAccessKey)
      checkInitDebugLogNoSecrets(fakeAzureBlobConfig.sasURLPrivate)
      checkInitDebugLogNoSecrets(fakeAzureBlobConfig.sasURLPublic)
    })
  })

  describe('when passing openwhisk credentials', () => {
    const fakeTVMResponse = {
      fakeTVMResponse: 'response'
    }
    const fakeOWCreds = {
      auth: 'fakeAuth',
      namespace: 'fakeNs'
    }
    const fakeTVMOptions = {
      some: 'options'
    }
    const azureBlobTvmMock = jest.fn()
    beforeEach(async () => {
      TvmClient.mockReset()
      TvmClient.init.mockReset()
      azureBlobTvmMock.mockReset()
      TvmClient.init.mockResolvedValue({
        getAzureBlobCredentials: azureBlobTvmMock
      })
    })
    test('when tvm options', async () => {
      azureBlobTvmMock.mockResolvedValue(fakeTVMResponse)
      await filesLib.init({ ow: fakeOWCreds, tvm: fakeTVMOptions })
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: fakeOWCreds, ...fakeTVMOptions })
      expect(AzureBlobFiles.init).toHaveBeenCalledTimes(1)
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeTVMResponse)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
      checkInitDebugLogNoSecrets(fakeOWCreds.auth)
    })
    test('when empty config to be able to pass OW creds as env variables', async () => {
      azureBlobTvmMock.mockResolvedValue(fakeTVMResponse)
      await filesLib.init()
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: undefined })
      expect(AzureBlobFiles.init).toHaveBeenCalledTimes(1)
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeTVMResponse)
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
    })
    test('when tvm rejects with a 401 (throws wrapped error)', async () => {
      azureBlobTvmMock.mockRejectedValue({ status: 401, sdkDetails: { details: 'fake' } })
      await global.expectToThrowBadCredentials(filesLib.init.bind(filesLib, { ow: fakeOWCreds }), { details: 'fake' })
    })
    test('when tvm rejects with a 403 (throws wrapped error)', async () => {
      azureBlobTvmMock.mockRejectedValue({ status: 403, sdkDetails: { details: 'fake' } })
      await global.expectToThrowBadCredentials(filesLib.init.bind(filesLib, { ow: fakeOWCreds }), { details: 'fake' })
    })
    test('when tvm rejects with another status code (throws tvm error)', async () => {
      const tvmError = new Error({ status: 500 })
      azureBlobTvmMock.mockRejectedValue(tvmError)
      try {
        await filesLib.init({ ow: fakeOWCreds })
      } catch (e) {
        expect(e).toBe(tvmError)
      }
    })
  })
})
