const storageSDK = require('../..')
const { StorageError } = require('../../lib/StorageError')
const { AzureStorage } = require('../../lib/azure/AzureStorage')

const { TvmClient } = require('../../lib/TvmClient')
jest.mock('../../lib/TvmClient')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const maxDate = new Date(8640000000000000).toISOString()
let fakeAzureSASCredentials
let fakeAzureUserCredentials
let fakeAzureTVMResponse
let fakeOWCreds
beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()

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

describe('init', () => {
  describe('init with bad arguments', () => {
    test('empty credentials', async () => {
      expect.assertions(3)
      try {
        await storageSDK.init()
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.BadArgument)
        expect(e.message).toContain('credentials')
      }
    })
    test('credentials with empty ow object', async () => {
      expect.assertions(3)
      try {
        await storageSDK.init({ ow: {} })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.BadArgument)
        expect(e.message).toContain('ow')
      }
    })

    test('credentials with empty azure object', async () => {
      expect.assertions(3)
      try {
        await storageSDK.init({ azure: {} })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.BadArgument)
        expect(e.message).toContain('azure')
      }
    })
  })

  describe('init with user provided regular credentials', () => {
    const fakeAzureAborter = 'fakeAborter'
    let fakeContainerCreate
    beforeEach(async () => {
      azure.ContainerURL = { fromServiceURL: jest.fn() }
      azure.Aborter = { none: fakeAzureAborter }
      fakeContainerCreate = jest.fn()
      azure.ContainerURL.fromServiceURL.mockReturnValue({ create: fakeContainerCreate })
    })

    test('containers do not exist', async () => {
      await storageSDK.init({ azure: fakeAzureUserCredentials })
      expect(fakeContainerCreate).toHaveBeenCalledTimes(2)
      expect(fakeContainerCreate).toHaveBeenNthCalledWith(2, fakeAzureAborter, { access: 'blob' })
    })
    test('containers already exist', async () => {
      fakeContainerCreate.mockRejectedValue({ body: { Code: 'ContainerAlreadyExists' } })
      await storageSDK.init({ azure: fakeAzureUserCredentials })
      expect(fakeContainerCreate).toHaveBeenCalledTimes(2)
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
    })
    test('provider error on container creation', async () => {
      expect.assertions(2)
      fakeContainerCreate.mockRejectedValue('error')
      try {
        await storageSDK.init({ azure: fakeAzureUserCredentials })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
      }
    })
    test('provider error with status on container creation', async () => {
      expect.assertions(3)
      fakeContainerCreate.mockRejectedValue({ response: { status: 500 } })
      try {
        await storageSDK.init({ azure: fakeAzureUserCredentials })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
        expect(e.message).toContain('500')
      }
    })
    test('provider error with forbidden status on container creation', async () => {
      expect.assertions(2)
      fakeContainerCreate.mockRejectedValue({ response: { status: 403 } })
      try {
        await storageSDK.init({ azure: fakeAzureUserCredentials })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Forbidden)
      }
    })
  })

  describe('init with user provided SAS credentials', () => {
    const fakeAzureAborter = 'fakeAborter'
    const fakeAzurePipeline = 'fakeAzurePipeline'
    beforeEach(async () => {
      azure.StorageURL = { newPipeline: () => fakeAzurePipeline }
      azure.ContainerURL = jest.fn()
      azure.Aborter = { none: fakeAzureAborter }
    })
    test('container objects are instantiated', async () => {
      const storage = await storageSDK.init({ azure: fakeAzureSASCredentials })
      expect(azure.ContainerURL).toHaveBeenNthCalledWith(1, fakeAzureSASCredentials.sasURLPrivate, fakeAzurePipeline)
      expect(azure.ContainerURL).toHaveBeenNthCalledWith(2, fakeAzureSASCredentials.sasURLPublic, fakeAzurePipeline)
      expect(storage).toBeInstanceOf(AzureStorage)
    })
  })

  describe('init with OpenWhisk credentials', () => {
    const fakeTvmApiUrl = 'http://fakeApiUrl'
    const fakeTvmCacheFile = 'fake-cache.file'
    const fakeAzureAborter = 'fakeAborter'
    const fakeAzurePipeline = 'fakeAzurePipeline'
    beforeEach(async () => {
      azure.StorageURL = { newPipeline: () => fakeAzurePipeline }
      azure.ContainerURL = jest.fn()
      azure.Aborter = { none: fakeAzureAborter }
      TvmClient.mockRestore()
      TvmClient.prototype.getAzureBlobCredentials.mockRestore()
      TvmClient.prototype.getAzureBlobCredentials.mockResolvedValue(fakeAzureTVMResponse)
      delete process.env['__OW_AUTH']
      delete process.env['__OW_NAMESPACE']
      delete process.env['OW_AUTH']
      delete process.env['OW_NAMESPACE']
    })
    test('tvm url is called with default url and container objects instantiated', async () => {
      const storage = await storageSDK.init({ ow: fakeOWCreds })
      expect(azure.ContainerURL).toHaveBeenNthCalledWith(1, fakeAzureSASCredentials.sasURLPrivate, fakeAzurePipeline)
      expect(azure.ContainerURL).toHaveBeenNthCalledWith(2, fakeAzureSASCredentials.sasURLPublic, fakeAzurePipeline)
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
    })
    test('tvm url can be specified', async () => {
      const storage = await storageSDK.init({ ow: fakeOWCreds }, { tvmApiUrl: fakeTvmApiUrl })
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: fakeTvmApiUrl })
    })
    test('tvm cache file can be specified', async () => {
      const storage = await storageSDK.init({ ow: fakeOWCreds }, { tvmCacheFile: fakeTvmCacheFile })
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl, cacheFile: fakeTvmCacheFile })
    })
    test('credentials can be passed through env vars OW_XXXX', async () => {
      process.env['OW_AUTH'] = fakeOWCreds.auth
      process.env['OW_NAMESPACE'] = fakeOWCreds.namespace
      const storage = await storageSDK.init()
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
    })
    test('credentials can be passed through env vars __OW_XXXX', async () => {
      process.env['__OW_AUTH'] = fakeOWCreds.auth
      process.env['__OW_NAMESPACE'] = fakeOWCreds.namespace
      const storage = await storageSDK.init()
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
    })
    test('__OW_AUTH can be passed through env vars and namespace through arg', async () => {
      process.env['__OW_AUTH'] = fakeOWCreds.auth
      const storage = await storageSDK.init({ ow: { namespace: fakeOWCreds.namespace } })
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(TvmClient.prototype.getAzureBlobCredentials).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledTimes(1)
      expect(TvmClient).toHaveBeenCalledWith({ ow: fakeOWCreds, apiUrl: storageSDK._defaultTvmApiUrl })
    })
    test('tvm returns with a 401', async () => {
      expect.assertions(2)
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 401 })
      try {
        await storageSDK.init({ ow: fakeOWCreds })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Forbidden)
      }
    })
    test('tvm returns with a 403', async () => {
      expect.assertions(2)
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 403 })
      try {
        await storageSDK.init({ ow: fakeOWCreds })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Forbidden)
      }
    })
    test('tvm returns with an unhandled status code', async () => {
      expect.assertions(3)
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({ statusCode: 500 })
      try {
        await storageSDK.init({ ow: fakeOWCreds })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
        expect(e.message).toContain('500')
      }
    })
    test('tvm returns with no status code', async () => {
      expect.assertions(2)
      TvmClient.prototype.getAzureBlobCredentials.mockRejectedValue({})
      try {
        await storageSDK.init({ ow: fakeOWCreds })
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
      }
    })
  })
})
