const storageSDK = require('../index')

const { AzureStorage } = require('../lib/azure/AzureStorage')
jest.mock('../lib/azure/AzureStorage.js')

const { TvmClient } = require('../lib/TvmClient')
jest.mock('../lib/TvmClient')

beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

describe('init', () => {
  /* Common setup for init tests */
  const maxDate = new Date(8640000000000000).toISOString()
  let fakeAzureSASCredentials
  let fakeAzureUserCredentials
  let fakeAzureTVMResponse
  let fakeOWCreds
  beforeEach(async () => {
    AzureStorage.mockRestore()
    AzureStorage.init = jest.fn()
    fakeAzureSASCredentials = {
      sasURLPrivate: 'https://fake.com/private',
      sasURLPublic: 'https://fake.com/public'
    }
    fakeAzureUserCredentials = {
      containerName: 'fake',
      storageAccessKey: 'fakeKey',
      storageAccount: 'fakeAccount'
    }
    fakeAzureTVMResponse = {
      expiration: maxDate,
      ...fakeAzureSASCredentials
    }
    fakeOWCreds = {
      auth: 'fake',
      namespace: 'fake'
    }
  })

  describe('with bad arguments', () => {
    test('when empty credentials', async () => {
      await expect(storageSDK.init).toThrowBadArgWithMessageContaining(['credentials', 'required'])
    })
    test('when credentials with empty ow object', async () => {
      await expect(storageSDK.init.bind(null, { ow: {} })).toThrowBadArgWithMessageContaining(['ow'])
    })
    test('when credentials with empty azure object', async () => {
      await expect(storageSDK.init.bind(null, { azure: {} })).toThrowBadArgWithMessageContaining(['azure'])
    })
    test('when credentials with both ow and azure credentials set', async () => {
      await expect(storageSDK.init.bind(null, { azure: fakeAzureUserCredentials, ow: fakeOWCreds })).toThrowBadArgWithMessageContaining(['azure', 'ow'])
    })
  })

  describe('with user provided azure credentials', () => {
    test('when storage account credentials are specified', async () => {
      await storageSDK.init({ azure: fakeAzureUserCredentials })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureUserCredentials)
      expect(TvmClient).toHaveBeenCalledTimes(0)
    })

    test('when SAS credentials are specified', async () => {
      await storageSDK.init({ azure: fakeAzureSASCredentials })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureSASCredentials)
      expect(TvmClient).toHaveBeenCalledTimes(0)
    })
  })

  describe('with OpenWhisk credentials', () => {
    const fakeTvmApiUrl = 'http://fakeApiUrl'
    const fakeTvmCacheFile = 'fake-cache.file'
    beforeEach(async () => {
      TvmClient.mockRestore()
      TvmClient.prototype.getAzureBlobCredentials.mockRestore()
      TvmClient.prototype.getAzureBlobCredentials.mockResolvedValue(fakeAzureTVMResponse)
      delete process.env['__OW_AUTH']
      delete process.env['__OW_NAMESPACE']
      delete process.env['OW_AUTH']
      delete process.env['OW_NAMESPACE']
    })
    test('when tvm url is not specified', async () => {
      await storageSDK.init({ ow: fakeOWCreds })
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when tvm url is specified', async () => {
      await storageSDK.init({ ow: fakeOWCreds }, { tvmApiUrl: fakeTvmApiUrl })
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: fakeTvmApiUrl })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when tvm cache file is specified', async () => {
      await storageSDK.init({ ow: fakeOWCreds }, { tvmCacheFile: fakeTvmCacheFile })
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl, cacheFile: fakeTvmCacheFile })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when credentials are passed through env vars OW_XXXX', async () => {
      process.env['OW_AUTH'] = fakeOWCreds.auth
      process.env['OW_NAMESPACE'] = fakeOWCreds.namespace
      await storageSDK.init()
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when credentials are passed through env vars __OW_XXXX', async () => {
      process.env['__OW_AUTH'] = fakeOWCreds.auth
      process.env['__OW_NAMESPACE'] = fakeOWCreds.namespace
      await storageSDK.init()
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when __OW_AUTH is passed through env var and namespace through arg', async () => {
      process.env['__OW_AUTH'] = fakeOWCreds.auth
      await storageSDK.init({ ow: { namespace: fakeOWCreds.namespace } })
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
      expect(AzureStorage.init).toHaveBeenCalledTimes(1)
      expect(AzureStorage.init).toHaveBeenCalledWith(fakeAzureTVMResponse)
    })
    test('when tvm rejects with a 401', async () => {
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 401 })
      await expect(storageSDK.init.bind(storageSDK, { ow: fakeOWCreds })).toThrowForbidden()
    })
    test('when tvm rejects with a 403', async () => {
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 403 })
      await expect(storageSDK.init.bind(storageSDK, { ow: fakeOWCreds })).toThrowForbidden()
    })
    test('when tvm rejects with an unhandled status code', async () => {
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 444 })
      await expect(storageSDK.init.bind(storageSDK, { ow: fakeOWCreds })).toThrowInternalWithStatus(444)
    })
    test('when tvm rejects with no status code', async () => {
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue(true)
      await expect(storageSDK.init.bind(storageSDK, { ow: fakeOWCreds })).toThrowInternal()
    })
  })
})
