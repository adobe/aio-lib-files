const { AzureStorage } = require('../../lib/azure/AzureStorage')
const { StorageError } = require('../../lib/StorageError')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const fakeSASCredentials = {
  sasURLPrivate: 'https://fake.com/private',
  sasURLPublic: 'https://fake.com/public'
}
const fakeAborter = 'fakeAborter'

beforeEach(async () => {
  expect.hasAssertions()
  jest.resetAllMocks()
})

describe('init', () => {
  const fakeAzureAborter = 'fakeAborter'
  const mockContainerCreate = jest.fn()
  const fakeUserCredentials = {
    containerName: 'fake',
    storageAccessKey: 'fakeKey',
    storageAccount: 'fakeAccount'
  }
  beforeEach(async () => {
    mockContainerCreate.mockReset()
    azure.ContainerURL = { fromServiceURL: jest.fn() }
    azure.Aborter = { none: fakeAzureAborter }
    azure.ContainerURL.fromServiceURL.mockReturnValue({ create: mockContainerCreate })
  })

  describe('with bad args', () => {
    test('when called with no arguments', async () => {
      await expect(AzureStorage.init).toThrowBadArgWithMessageContaining(['credentials', 'required'])
    })
    test('when called with incomplete SAS credentials', async () => {
      const badInput = { ...fakeSASCredentials }
      delete badInput.sasURLPrivate
      await expect(AzureStorage.init.bind(null, badInput)).toThrowBadArgWithMessageContaining(['credentials', 'required', 'sasURLPrivate'])
    })
    test('when called with incomplete user credentials', async () => {
      const badInput = { ...fakeUserCredentials }
      delete badInput.containerName
      await expect(AzureStorage.init.bind(null, badInput)).toThrowBadArgWithMessageContaining(['credentials', 'required', 'containerName'])
    })
    test('when called with both sas and user credentials', async () => {
      await expect(AzureStorage.init.bind(null, { ...fakeUserCredentials, ...fakeSASCredentials })).toThrowBadArgWithMessageContaining(['credentials', 'conflict'])
    })
  })

  describe('with azure storage account credentials', () => {
    test('when public/private blob containers do not exist', async () => {
      const storage = await AzureStorage.init(fakeUserCredentials)
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(mockContainerCreate).toHaveBeenCalledTimes(2)
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
    })
    test('when blob containers already exist', async () => {
      // here we make sure that no error is thrown (ignore if already exist)
      mockContainerCreate.mockRejectedValue({ body: { Code: 'ContainerAlreadyExists' } })
      const storage = await AzureStorage.init(fakeUserCredentials)
      expect(storage).toBeInstanceOf(AzureStorage)
      expect(mockContainerCreate).toHaveBeenCalledTimes(2)
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
    })
    test('when there is an unknown error on blob container creation', async () => {
      mockContainerCreate.mockRejectedValue('error')
      await expect(AzureStorage.init.bind(null, fakeUserCredentials)).toThrowInternal()
      mockContainerCreate.mockRejectedValue({ response: { status: 444 } })
      await expect(AzureStorage.init.bind(null, fakeUserCredentials)).toThrowInternalWithStatus(444)
    })
    test('when there is an error with forbidden status on blob container creation', async () => {
      mockContainerCreate.mockRejectedValue({ response: { status: 403 } })
      await expect(AzureStorage.init.bind(null, fakeUserCredentials)).toThrowForbidden()
    })
  })
  test('with azure SAS credentials', async () => {
    // change to describe with beforeEach when more than one test for SAS credentials
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

describe('list', () => {
  /* Common setup for list tests */
  // could be also OpenWhisk or regular azure credentials
  const fileInPrivateDir = 'dir/inadir/file.html'
  const fileInRoot = 'afile.html'
  const fileInPublicDir = 'public/afile.html'
  const fileInPublicSubDir = 'public/sub/afile.html'
  const fileWithoutExtension = 'afile'
  const privateDir = 'some/private/dir/'
  const publicDir = 'public/some/dir/'
  const fakeAzureListResponse = (files, marker) => { return { marker: marker, segment: { blobItems: files.map(name => { return { name } }) } } }
  const fakeAzureFileProps = { fake: 'props' }
  const mockBlobGetProperties = jest.fn()
  const mockContainerPublicList = jest.fn()
  const mockContainerPrivateList = jest.fn()
  const fakeListArguments = (prefix, marker) => [fakeAborter, marker, { prefix: prefix, delimiter: '/' }]
  let storage

  beforeEach(async () => {
    mockBlobGetProperties.mockReset()
    mockContainerPublicList.mockReset()
    mockContainerPrivateList.mockReset()
    azure.ContainerURL = jest.fn()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ getProperties: mockBlobGetProperties })
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.containerURLPrivate = { listBlobFlatSegment: mockContainerPrivateList }
    storage._azure.containerURLPublic = { listBlobFlatSegment: mockContainerPublicList }
    storage._azure.aborter = fakeAborter
  })

  describe('a file', () => {
    test('when it exists', async () => {
      mockBlobGetProperties.mockResolvedValue(fakeAzureFileProps)
      expect(await storage.list(fileInPrivateDir)).toEqual([fileInPrivateDir])
      expect(await storage.list(fileInRoot)).toEqual([fileInRoot])
      expect(await storage.list(fileInPublicDir)).toEqual([fileInPublicDir])
      expect(await storage.list(fileInPublicSubDir)).toEqual([fileInPublicSubDir])
      expect(await storage.list(fileWithoutExtension)).toEqual([fileWithoutExtension])
      expect(mockBlobGetProperties).toHaveBeenCalled()
      expect(mockContainerPublicList).toHaveBeenCalledTimes(0)
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(0)
    })
    test('when it does not exist', async () => {
      mockBlobGetProperties.mockRejectedValue({ response: { status: 404 } })
      expect(await storage.list(fileInPrivateDir)).toEqual([])
      expect(await storage.list(fileInRoot)).toEqual([])
      expect(await storage.list(fileInPublicDir)).toEqual([])
      expect(await storage.list(fileInPublicSubDir)).toEqual([])
      expect(await storage.list(fileWithoutExtension)).toEqual([])
      expect(mockBlobGetProperties).toHaveBeenCalled()
      expect(mockContainerPublicList).toHaveBeenCalledTimes(0)
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(0)
    })
    test('when there is an unknown provider error', async () => {
      mockBlobGetProperties.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.list.bind(storage, fileInPrivateDir)).toThrowInternalWithStatus(444)
      mockBlobGetProperties.mockRejectedValue(true)
      await expect(storage.list.bind(storage, fileInPrivateDir)).toThrowInternal()
    })
    test('when there is a forbidden provider error', async () => {
      mockBlobGetProperties.mockRejectedValue({ response: { status: 403 } })
      await expect(storage.list.bind(storage, fileInPrivateDir)).toThrowForbidden()
    })
  })

  describe('a directory', () => {
    // eslint-disable-next-line jsdoc/require-jsdoc
    function testRoot (rootString) {
      return async () => {
        mockContainerPublicList.mockResolvedValue(fakeAzureListResponse([fileInPublicDir, fileInPublicSubDir]))
        mockContainerPrivateList.mockResolvedValue(fakeAzureListResponse([fileInPrivateDir, fileInRoot]))
        expect(await storage.list(rootString)).toEqual([fileInPrivateDir, fileInRoot, fileInPublicDir, fileInPublicSubDir])
        expect(mockBlobGetProperties).toHaveBeenCalledTimes(0)
        expect(mockContainerPublicList).toHaveBeenCalledTimes(1)
        expect(mockContainerPublicList).toHaveBeenCalledWith(...fakeListArguments('public'))
        expect(mockContainerPrivateList).toHaveBeenCalledTimes(1)
        expect(mockContainerPrivateList).toHaveBeenCalledWith(...fakeListArguments(''))
      }
    }

    test('when it is the root (`/`)', testRoot('/'))
    test('when it is the root (empty string)', testRoot(''))
    test('when it is the root (undefined arg)', testRoot())

    test('when it is a private', async () => {
      const files = ['file1', 'subdir/file2', 'another/subdir/file3'].map(f => privateDir + f)
      mockContainerPrivateList.mockResolvedValue(fakeAzureListResponse(files))
      expect(await storage.list(privateDir)).toEqual(files)
      expect(mockBlobGetProperties).toHaveBeenCalledTimes(0)
      expect(mockContainerPublicList).toHaveBeenCalledTimes(0)
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(1)
      expect(mockContainerPrivateList).toHaveBeenCalledWith(...fakeListArguments(privateDir))
    })
    test('when it is a public', async () => {
      const files = ['file1', 'subdir/file2', 'another/subdir/file3'].map(f => publicDir + f)
      mockContainerPublicList.mockResolvedValue(fakeAzureListResponse(files))
      expect(await storage.list(publicDir)).toEqual(files)
      expect(mockBlobGetProperties).toHaveBeenCalledTimes(0)
      expect(mockContainerPublicList).toHaveBeenCalledTimes(1)
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(0)
      expect(mockContainerPublicList).toHaveBeenCalledWith(...fakeListArguments(publicDir))
    })
    test('when multiple calls are needed to list all files', async () => {
      const files = [['file1', 'subdir/file2', 'another/subdir/file3'], ['file4', 'subdir/file5', 'another/subdir/file6'], ['file7']].map(arr => arr.map(f => publicDir + f))
      let count = 0
      mockContainerPublicList.mockImplementation(async () => { return fakeAzureListResponse(files[count++], count < files.length) })
      expect(await storage.list(publicDir)).toEqual(files.reduce((prev, curr) => prev.concat(curr), []))
      expect(mockBlobGetProperties).toHaveBeenCalledTimes(0)
      expect(mockContainerPublicList).toHaveBeenCalledTimes(3)
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(0)
      expect(mockContainerPublicList).toHaveBeenCalledWith(...fakeListArguments(publicDir))
    })
    test('when there is an unknown provider error', async () => {
      mockContainerPublicList.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.list.bind(storage, publicDir)).toThrowInternalWithStatus(444)
      mockContainerPublicList.mockRejectedValue(true)
      await expect(storage.list.bind(storage, publicDir)).toThrowInternal()
    })
    test('when there is a forbidden provider error', async () => {
      mockContainerPublicList.mockRejectedValue({ response: { status: 403 } })
      await expect(storage.list.bind(storage, publicDir)).toThrowForbidden()
    })
  })
})

describe('delete', () => {
  /* Common setup for delete tests */
  const fakeDir = 'a/dir/'
  const fakeFiles = ['file1', 'folder/file2', 'file3'].map(f => fakeDir + f)
  const mockList = jest.fn()
  const mockAzureDelete = jest.fn()
  let storage

  beforeEach(async () => {
    mockAzureDelete.mockReset()
    mockAzureDelete.mockResolvedValue(true) // defaults to promise
    mockList.mockReset()
    azure.ContainerURL = jest.fn()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ delete: mockAzureDelete })
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
    storage.list = mockList
  })

  test('a file', async () => {
    mockList.mockResolvedValue([fakeFiles[0]])
    const res = await storage.delete(fakeFiles[0])
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList).toHaveBeenCalledWith(fakeFiles[0])
    expect(mockAzureDelete).toHaveBeenCalledTimes(1)
    expect(res).toEqual([fakeFiles[0]])
  })
  test('a file that does not exist', async () => {
    mockList.mockResolvedValue([])
    const res = await storage.delete(fakeFiles[0])
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList).toHaveBeenCalledWith(fakeFiles[0])
    expect(mockAzureDelete).toHaveBeenCalledTimes(0)
    expect(res).toEqual([])
  })
  test('a directory with 3 files when options.progressCallback is set', async () => {
    const mockProgressCB = jest.fn()
    mockList.mockResolvedValue(fakeFiles)
    const res = await storage.delete(fakeDir, { progressCallback: mockProgressCB })
    expect(res).toEqual(fakeFiles)
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList).toHaveBeenCalledWith(fakeDir)
    expect(mockAzureDelete).toHaveBeenCalledTimes(3)
    expect(mockProgressCB).toHaveBeenCalledWith(fakeFiles[0])
    expect(mockProgressCB).toHaveBeenCalledWith(fakeFiles[1])
    expect(mockProgressCB).toHaveBeenCalledWith(fakeFiles[2])
    expect(mockProgressCB).toHaveBeenCalledTimes(3)
  })
  test('an empty directory', async () => {
    const mockProgressCB = jest.fn()
    mockList.mockResolvedValue([])
    const res = await storage.delete(fakeDir, { progressCallback: mockProgressCB })
    expect(res).toEqual([])
    expect(mockList).toHaveBeenCalledTimes(1)
    expect(mockList).toHaveBeenCalledWith(fakeDir)
    expect(mockAzureDelete).toHaveBeenCalledTimes(0)
    expect(mockProgressCB).toHaveBeenCalledTimes(0)
  })
  test('when azure.BlockBlobURL.delete rejects with a forbidden status', async () => {
    mockList.mockResolvedValue(fakeFiles)
    mockAzureDelete.mockRejectedValue({ response: { status: 403 } })
    await expect(storage.delete.bind(storage, fakeDir)).toThrowForbidden()
  })
  test('when azure.BlockBlobURL.delete rejects with an unknown status/error', async () => {
    mockList.mockResolvedValue(fakeFiles)
    mockAzureDelete.mockRejectedValue({ response: { status: 444 } })
    await expect(storage.delete.bind(storage, fakeDir)).toThrowInternalWithStatus(444)
    mockAzureDelete.mockRejectedValue(true)
    await expect(storage.delete.bind(storage, fakeDir)).toThrowInternal
  })
  test('when list rejects with an error', async () => {
    let error = new StorageError('fakeError')
    mockList.mockRejectedValue(error)
    await expect(storage.delete(fakeDir)).rejects.toThrow(error)
    error = new Error('fakeError')
    mockList.mockRejectedValue(error)
    await expect(storage.delete(fakeDir)).rejects.toThrow(error)
  })
})
