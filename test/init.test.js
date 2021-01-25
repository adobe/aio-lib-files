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

const filesLib = require('../')

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

  test('exports a function', () => {
    expect(filesLib).toBeDefined()
    // init()
    expect(filesLib.init).toBeDefined()
    expect(typeof filesLib.init).toBe('function')
    // FilePermissions
    expect(filesLib.FilePermissions).toBeDefined()
    expect(filesLib.FilePermissions).toEqual(expect.objectContaining({ READ: expect.any(String), WRITE: expect.any(String) }))

    // UrlType
    expect(filesLib.UrlType).toBeDefined()
    expect(filesLib.UrlType).toEqual(expect.objectContaining({ internal: expect.any(String), external: expect.any(String) }))
  })

  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('when passing azure credentials (owned by user)', () => {
    const azureBlobTvmMock = jest.fn()
    const fakeAzureBlobConfig = {
      fake: 'azureblobconfig',
      // to be hidden
      sasURLPrivate: 'https://fakessasprivate?secret',
      sasURLPublic: 'https://fakesaspublic?secret',
      storageAccessKey: 'fakestorageaccesskey'
    }
    beforeEach(async () => {
      TvmClient.mockReset()
      TvmClient.init.mockReset()
      azureBlobTvmMock.mockReset()
      TvmClient.init.mockResolvedValue({
        getAzureBlobCredentials: azureBlobTvmMock
      })
    })

    test('with azure config', async () => {
      await filesLib.init({ azure: fakeAzureBlobConfig })
      expect(AzureBlobFiles.init).toHaveBeenCalledTimes(1)
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeAzureBlobConfig, null)
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
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeTVMResponse, {
        getAzureBlobCredentials: azureBlobTvmMock
      })
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
      checkInitDebugLogNoSecrets(fakeOWCreds.auth)
    })

    test('when empty config to be able to pass OW creds as env variables', async () => {
      azureBlobTvmMock.mockResolvedValue(fakeTVMResponse)
      await filesLib.init()
      expect(TvmClient.init).toHaveBeenCalledTimes(1)
      expect(TvmClient.init).toHaveBeenCalledWith({ ow: undefined })
      expect(AzureBlobFiles.init).toHaveBeenCalledTimes(1)
      expect(AzureBlobFiles.init).toHaveBeenCalledWith(fakeTVMResponse, {
        getAzureBlobCredentials: azureBlobTvmMock
      })
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('openwhisk'))
    })

    // eslint-disable-next-line jest/expect-expect
    test('when tvm rejects with a 401 (throws wrapped error)', async () => {
      const e = new Error('tvm error')
      e.sdkDetails = { fake: 'details', status: 401 }
      azureBlobTvmMock.mockRejectedValue(e)
      await global.expectToThrowBadCredentials(filesLib.init.bind(filesLib, { ow: fakeOWCreds }), e.sdkDetails, 'TVM')
    })

    // eslint-disable-next-line jest/expect-expect
    test('when tvm rejects with a 403 (throws wrapped error)', async () => {
      const e = new Error('tvm error')
      e.sdkDetails = { fake: 'details', status: 403 }
      azureBlobTvmMock.mockRejectedValue(e)
      await global.expectToThrowBadCredentials(filesLib.init.bind(filesLib, { ow: fakeOWCreds }), e.sdkDetails, 'TVM')
    })

    test('when tvm rejects with another status code (throws tvm error)', async () => {
      const tvmError = new Error('tvm error')
      tvmError.sdkDetails = { fake: 'details', status: 500 }
      azureBlobTvmMock.mockRejectedValue(tvmError)
      try {
        await filesLib.init({ ow: fakeOWCreds })
      } catch (e) {
        // eslint-disable-next-line jest/no-try-expect
        expect(e).toBe(tvmError)
      }
    })
  })
})
