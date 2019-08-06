const { StorageError } = require('../../lib/StorageError')
const { AzureStorage } = require('../../lib/azure/AzureStorage')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

beforeEach(async () => {
  expect.hasAssertions()
  jest.restoreAllMocks()
})

describe('init', () => {
  const fakeAzureAborter = 'fakeAborter'
  let fakeContainerCreate
  let fakeSASCredentials
  let fakeUserCredentials
  beforeEach(async () => {
    fakeSASCredentials = {
      sasURLPrivate: 'https://fake.com/private',
      sasURLPublic: 'https://fake.com/public'
    }
    fakeUserCredentials = {
      containerName: 'fake',
      storageAccessKey: 'fakeKey',
      storageAccount: 'fakeAccount'
    }
  })
  beforeEach(async () => {
    azure.ContainerURL = { fromServiceURL: jest.fn() }
    azure.Aborter = { none: fakeAzureAborter }
    fakeContainerCreate = jest.fn()
    azure.ContainerURL.fromServiceURL.mockReturnValue({ create: fakeContainerCreate })
  })

  describe('with bad args', () => {
    test('when called with no arguments', async () => {
      expect.assertions(4)
      try {
        await AzureStorage.init()
      } catch (e) {
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.BadArgument)
        expect(e.message).toContain('credentials')
        expect(e.message).toContain('required')
      }
    })
  })

  describe('with azure storage account credentials', () => {
    test('when public/private blob containers do not exist', async () => {
      const storage = await AzureStorage.init(fakeUserCredentials)
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(fakeContainerCreate).toHaveBeenCalledTimes(2)
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
    })
    test('when blob containers already exist', async () => {
      // here we make sure that no error is thrown (ignore if already exist)
      fakeContainerCreate.mockRejectedValue({ body: { Code: 'ContainerAlreadyExists' } })
      const storage = await AzureStorage.init(fakeUserCredentials)
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(fakeContainerCreate).toHaveBeenCalledTimes(2)
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(fakeContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
    })
    test('when there is an error on blob container creation', async () => {
      expect.assertions(2)
      fakeContainerCreate.mockRejectedValue('error')
      try {
        await AzureStorage.init(fakeUserCredentials)
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
      }
    })
    test('when there is an error with status on blob container creation', async () => {
      expect.assertions(3)
      fakeContainerCreate.mockRejectedValue({ response: { status: 500 } })
      try {
        await AzureStorage.init(fakeUserCredentials)
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Internal)
        expect(e.message).toContain('500')
      }
    })
    test('when there is an error with forbidden status on blob container creation', async () => {
      expect.assertions(2)
      fakeContainerCreate.mockRejectedValue({ response: { status: 403 } })
      try {
        await AzureStorage.init(fakeUserCredentials)
      } catch (e) {
        // we expect every provider error to be wrapped
        expect(e).toBeInstanceOf(StorageError)
        expect(e.code).toEqual(StorageError.codes.Forbidden)
      }
    })
  })

  // change to describe with beforeEach when more than one test for SAS credentials
  test('with azure SAS credentials', async () => {
    // setup & before
    const fakeAzurePipeline = 'fakeAzurePipeline'
    const fakeAzureAborter = 'fakeAborter'
    azure.StorageURL = { newPipeline: () => fakeAzurePipeline }
    azure.ContainerURL = jest.fn()
    azure.Aborter = { none: fakeAzureAborter }
    // test
    const storage = await AzureStorage.init(fakeSASCredentials)
    expect(azure.ContainerURL).toHaveBeenNthCalledWith(1, fakeSASCredentials.sasURLPrivate, fakeAzurePipeline)
    expect(azure.ContainerURL).toHaveBeenNthCalledWith(2, fakeSASCredentials.sasURLPublic, fakeAzurePipeline)
    expect(storage).toBeInstanceOf(AzureStorage)
  })
})
