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

const { AzureStorage } = require('../../lib/azure/AzureStorage')
const { StorageError } = require('../../lib/StorageError')
const stream = require('stream')
const upath = require('upath')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const fs = require('fs-extra')
jest.mock('fs-extra')

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
    test('when azure.BlockBlobURL.getProperties rejects with a 403', async () => {
      mockBlobGetProperties.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.list.bind(storage, fileInPrivateDir)).toThrowInternalWithStatus(444)
      mockBlobGetProperties.mockRejectedValue(true)
      await expect(storage.list.bind(storage, fileInPrivateDir)).toThrowInternal()
    })
    test('when azure.BlockBlobURL.getProperties rejects with an unknown status/error', async () => {
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
    test('when azure.ContainerURL.list rejects with an unknown status/error', async () => {
      mockContainerPublicList.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.list.bind(storage, publicDir)).toThrowInternalWithStatus(444)
      mockContainerPublicList.mockRejectedValue(true)
      await expect(storage.list.bind(storage, publicDir)).toThrowInternal()
    })
    test('when azure.ContainerURL.list rejects with a 403 error', async () => {
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
  test('when azure.BlockBlobURL.delete rejects with 403', async () => {
    mockList.mockResolvedValue(fakeFiles)
    mockAzureDelete.mockRejectedValue({ response: { status: 403 } })
    await expect(storage.delete.bind(storage, fakeDir)).toThrowForbidden()
  })
  test('when azure.BlockBlobURL.delete rejects with an unknown status/error', async () => {
    mockList.mockResolvedValue(fakeFiles)
    mockAzureDelete.mockRejectedValue({ response: { status: 444 } })
    await expect(storage.delete.bind(storage, fakeDir)).toThrowInternalWithStatus(444)
    mockAzureDelete.mockRejectedValue(true)
    await expect(storage.delete.bind(storage, fakeDir)).toThrowInternal()
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

describe('createReadStream', () => {
  // todo read is not specific to azure (based on storage.createReadStream) can
  // we move this somewhere reusable?
  const fakeFile = 'a/dir/file1'
  const mockAzureDownload = jest.fn()
  let storage
  beforeEach(async () => {
    mockAzureDownload.mockReset()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ download: mockAzureDownload })
    azure.ContainerURL = jest.fn()
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
  })

  describe('for a file', () => {
    let fakeRdStream
    const fakeOptions = { position: 1, length: 10 }
    beforeEach(() => {
      fakeRdStream = new stream.Readable()
      fakeRdStream.push(null)
      mockAzureDownload.mockResolvedValue({ readableStreamBody: fakeRdStream })
    })
    test('w/o options', async () => {
      const res = await storage.createReadStream(fakeFile)
      expect(res).toBe(fakeRdStream)
      expect(mockAzureDownload).toHaveBeenCalledTimes(1)
      expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, 0, undefined)
    })
    test('with options', async () => {
      const res = await storage.createReadStream(fakeFile, fakeOptions)
      expect(res).toBe(fakeRdStream)
      expect(mockAzureDownload).toHaveBeenCalledTimes(1)
      expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, fakeOptions.position, fakeOptions.length)
    })
  })

  test('for a directory (not allowed)', async () => {
    await expect(storage.createReadStream.bind(storage, 'a/dir/')).toThrowBadArgDirectory('a/dir/')
  })
  test('when azure.BlockBlobURL.download rejects with 404', async () => {
    mockAzureDownload.mockRejectedValue({ response: { status: 404 } })
    await expect(storage.createReadStream.bind(storage, fakeFile)).toThrowFileNotExists(fakeFile)
  })
  test('when azure.BlockBlobURL.download rejects with 403', async () => {
    mockAzureDownload.mockRejectedValue({ response: { status: 403 } })
    await expect(storage.createReadStream.bind(storage, fakeFile)).toThrowForbidden()
  })
  test('when azure.BlockBlobURL.download rejects with an unknown status/error', async () => {
    mockAzureDownload.mockRejectedValue({ response: { status: 444 } })
    await expect(storage.createReadStream.bind(storage, fakeFile)).toThrowInternalWithStatus(444)

    mockAzureDownload.mockRejectedValue(true)
    await expect(storage.createReadStream.bind(storage, fakeFile)).toThrowInternal()
  })
})

describe('read', () => {
  // todo read is not specific to azure (based on storage.createReadStream) we
  // should move it to a common/base test file once we have a second implementation
  const fakeFile = 'a/dir/file1'
  const mockCreateReadStream = jest.fn()
  let storage

  beforeEach(async () => {
    mockCreateReadStream.mockReset()
    azure.ContainerURL = jest.fn()
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
    storage.createReadStream = mockCreateReadStream
  })

  describe('a file', () => {
    let fakeRdStream
    const fakeContent = 'some fake content @#$%^&*()@!12-=][;"\n\trewq'
    const fakeOptions = { position: 1, length: 10 }
    beforeEach(() => {
      fakeRdStream = new stream.Readable()
      fakeRdStream.push(fakeContent)
      fakeRdStream.push(null)
      mockCreateReadStream.mockResolvedValue(fakeRdStream)
    })
    test('w/o options', async () => {
      const res = await storage.read(fakeFile, {})
      expect(res).toBeInstanceOf(Buffer)
      expect(res.toString()).toEqual(fakeContent)
      expect(mockCreateReadStream).toHaveBeenCalledTimes(1)
      expect(mockCreateReadStream).toHaveBeenCalledWith(fakeFile, {})
    })
    test('with options', async () => {
      // here we just check that the options are passed to the createReadStream
      // but don't care about what they do as we mock the returned content
      const res = await storage.read(fakeFile, fakeOptions)
      expect(res).toBeInstanceOf(Buffer)
      expect(res.toString()).toEqual(fakeContent)
      expect(mockCreateReadStream).toHaveBeenCalledTimes(1)
      expect(mockCreateReadStream).toHaveBeenCalledWith(fakeFile, fakeOptions)
    })
  })
  test('when createReadStream rejects with an error', async () => {
    // should cover file doesn't exist + is dir b/c known errors are thrown from createReadStream
    let error = new StorageError('fakeError')
    mockCreateReadStream.mockRejectedValue(error)
    await expect(storage.read(fakeFile)).rejects.toThrow(error)
    error = new Error('fakeError')
    mockCreateReadStream.mockRejectedValue(error)
    await expect(storage.read(fakeFile)).rejects.toThrow(error)
  })
})

describe('write', () => {
  const fakeFile = 'a/dir/file1'
  const mockAzureUpload = jest.fn()
  const mockAzureStreamUpload = jest.fn()
  let storage
  beforeEach(async () => {
    mockAzureStreamUpload.mockReset()
    mockAzureUpload.mockReset()
    mockAzureUpload.mockResolvedValue(true)
    mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
    azure.uploadStreamToBlockBlob = mockAzureStreamUpload
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ upload: mockAzureUpload })
    azure.ContainerURL = jest.fn()
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
  })

  test('to a directory (not allowed)', async () => {
    await expect(storage.createReadStream.bind(storage, 'a/dir/')).toThrowBadArgDirectory('a/dir/')
  })

  describe('to a file', () => {
    const fakeContent = 'some fake content @#$%^&*()@!12-=][;"\n\trewq'
    test('with html extension and content being a string', async () => {
      const res = await storage.write(fakeFile + '.html', fakeContent)
      expect(res).toBe(fakeContent.length)
      expect(mockAzureUpload).toHaveBeenCalledTimes(1)
      const buffer = Buffer.from(fakeContent)
      expect(mockAzureUpload).toHaveBeenCalledWith(fakeAborter, buffer, buffer.length, { blobHTTPHeaders: { blobContentType: 'text/html' } })
    })
    test('with html extension and content being a buffer', async () => {
      const buffer = Buffer.from(fakeContent)
      const res = await storage.write(fakeFile + '.json', buffer)
      expect(res).toBe(buffer.length)
      expect(mockAzureUpload).toHaveBeenCalledTimes(1)
      expect(mockAzureUpload).toHaveBeenCalledWith(fakeAborter, buffer, buffer.length, { blobHTTPHeaders: { blobContentType: 'application/json' } })
    })
    test('with no extension and content being a ReadableStream', async () => {
      const fakeRdStream = new stream.Readable()
      fakeRdStream.push(fakeContent)
      fakeRdStream.push(null)
      const res = await storage.write(fakeFile, fakeRdStream)
      expect(res).toBe(fakeContent.length)
      expect(mockAzureStreamUpload).toHaveBeenCalledTimes(1)
      expect(mockAzureStreamUpload.mock.calls[0]).toEqual(expect.arrayContaining([fakeRdStream, { blobHTTPHeaders: { blobContentType: 'application/octet-stream' } }]))
    })

    test('with string content when azure.BlockBlobURL.upload rejects with 403', async () => {
      mockAzureUpload.mockRejectedValue({ response: { status: 403 } })
      await expect(storage.write.bind(storage, fakeFile, fakeContent)).toThrowForbidden()
    })
    test('with string content when azure.BlockBlobURL.download rejects with an unknown status/error', async () => {
      mockAzureUpload.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.write.bind(storage, fakeFile, fakeContent)).toThrowInternalWithStatus(444)
      mockAzureUpload.mockRejectedValue(true)
      await expect(storage.write.bind(storage, fakeFile, fakeContent)).toThrowInternal()
    })
    test('with ReadableStream content when azure.uploadStreamToBlockBlob rejects with 403', async () => {
      const fakeRdStream = new stream.Readable()
      fakeRdStream.push(fakeContent)
      fakeRdStream.push(null)
      mockAzureStreamUpload.mockRejectedValue({ response: { status: 403 } })
      await expect(storage.write.bind(storage, fakeFile, fakeRdStream)).toThrowForbidden()
    })
    test('with ReadableStream content when azure.uploadStreamToBlockBlob rejects with an unknown status/error', async () => {
      const fakeRdStream = new stream.Readable()
      fakeRdStream.push(fakeContent)
      fakeRdStream.push(null)
      mockAzureStreamUpload.mockRejectedValue({ response: { status: 444 } })
      await expect(storage.write.bind(storage, fakeFile, fakeRdStream)).toThrowInternalWithStatus(444)
      mockAzureStreamUpload.mockRejectedValue(true)
      await expect(storage.write.bind(storage, fakeFile, fakeRdStream)).toThrowInternal()
    })
  })
})

describe('createWriteStream', () => {
  const fakeFile = 'a/dir/file1'
  const mockAzureStreamUpload = jest.fn()
  /** @type {AzureStorage} */
  let storage
  beforeEach(async () => {
    mockAzureStreamUpload.mockReset()
    mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
    azure.uploadStreamToBlockBlob = mockAzureStreamUpload
    azure.ContainerURL = jest.fn()
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
  })

  test('from a directory (not allowed)', async () => {
    await expect(storage.createWriteStream.bind(storage, 'a/dir/')).toThrowBadArgDirectory('a/dir/')
  })

  describe('from a file', () => {
    const fakeChunks = ['some ', 'fake con', 'tent @#$%^&*()@!', '12-=][;"\n\trewq']
    const fakeChunksSize = fakeChunks.reduce((prev, curr) => prev + curr.length, 0)

    test('with html extension, write multiple chunks and end the stream', async done => {
      expect.assertions(5)
      const wrStream = await storage.createWriteStream(fakeFile + '.html')
      expect(wrStream).toBeInstanceOf(stream.Writable)
      fakeChunks.forEach(chunk => wrStream.write(chunk))
      wrStream.end()
      wrStream.on('finish', async bytesWritten => {
        expect(bytesWritten).toEqual(fakeChunksSize)
        // also check field
        expect(wrStream.bytesWritten).toEqual(fakeChunksSize)
        expect(mockAzureStreamUpload).toHaveBeenCalledTimes(1)
        expect(mockAzureStreamUpload.mock.calls[0]).toEqual(expect.arrayContaining([{ blobHTTPHeaders: { blobContentType: 'text/html' } }]))
        done()
      })
    })
    test('when stream is written and azure.uploadStreamToBlockBlob rejects with an unknown status/error', async done => {
      mockAzureStreamUpload.mockRejectedValue({ response: { status: 444 } })
      const wrStream = await storage.createWriteStream(fakeFile)
      wrStream.write('hi')
      wrStream.on('error', async e => {
        await expect(() => { throw e }).toThrowInternalWithStatus(444)
        done()
      })
    })
    test('when stream is written and azure.uploadStreamToBlockBlob rejects with 403', async done => {
      mockAzureStreamUpload.mockRejectedValue({ response: { status: 403 } })
      const wrStream = await storage.createWriteStream(fakeFile)
      wrStream.write('hi')
      wrStream.on('error', async e => {
        await expect(() => { throw e }).toThrowForbidden()
        done()
      })
    })
  })
})

describe('copy', () => {
  // if we make a separate test for copyRemoteToRemote we could make copy
  // generic
  const fakeSrcFile = 'a/dir/file1.html'
  const fakeDestFile = 'another/dir2/file2.txt'
  const fakeSrcDir = 'a/dir/'
  const fakeDestDir = 'another/dir2/'
  const mockCreateReadStream = jest.fn()
  const mockWrite = jest.fn()
  const mockList = jest.fn()
  const mockAzureCopy = jest.fn()
  /** @type {AzureStorage} */
  let storage

  const setMockList = (files = []) => {
    files = new Set(files)
    mockList.mockImplementation(file => {
      if (file.endsWith('/')) {
        // is dir
        return [...files].filter(f => f.startsWith(file))
      }
      return (files.has(file) && [file]) || []
    })
  }
  const pathFileInDir = (dir, file) => upath.join(dir, upath.basename(file))

  beforeEach(async () => {
    mockCreateReadStream.mockReset() // for remote -> local
    mockWrite.mockReset() // for local -> remote
    mockList.mockReset() // for all
    mockAzureCopy.mockReset() // for remote -> remote
    mockAzureCopy.mockResolvedValue(true)
    mockWrite.mockResolvedValue(true)

    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ startCopyFromURL: mockAzureCopy })
    azure.ContainerURL = jest.fn()
    storage = await AzureStorage.init(fakeSASCredentials)
    storage._azure.aborter = fakeAborter
    storage.createReadStream = mockCreateReadStream
    storage.list = mockList
    storage.write = mockWrite
    storage.createReadStream = mockCreateReadStream
  })

  describe('from a remote location to a remote location', () => {
    describe('with src and dest being files', () => {
      test('when source file does not exist', async () => {
        setMockList([fakeDestFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile)).toThrowFileNotExists(fakeSrcFile)
      })
      test('when dest does not exist and options.override true', async () => {
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { override: true })
        expect(res).toEqual([fakeDestFile])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest does not exist and override is false', async () => {
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { override: false })
        expect(res).toEqual([fakeDestFile])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest exists and options.override is true', async () => {
        setMockList([fakeSrcFile, fakeDestFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { override: true })
        expect(res).toEqual([fakeDestFile])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest exists and options.override is false', async () => {
        setMockList([fakeSrcFile, fakeDestFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile, { override: false })).toThrowFileExistsNoOverride()
      })
      test('when dest exists and options.override is not set (should default to false)', async () => {
        setMockList([fakeSrcFile, fakeDestFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile)).toThrowFileExistsNoOverride()
      })
      test('when options.progressCallback function is set', async () => {
        const mockProgressCb = jest.fn()
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { progressCallback: mockProgressCb })
        expect(res).toEqual([fakeDestFile])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
        expect(mockProgressCb).toHaveBeenCalledTimes(1)
        expect(mockProgressCb).toHaveBeenCalledWith(fakeDestFile)
      })
    })
    describe('with src being a file and dest being a folder', () => {
      test('when dest is empty', async () => {
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestDir)
        expect(res).toEqual([pathFileInDir(fakeDestDir, fakeSrcFile)])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest contains 3 files with a different names than src', async () => {
        setMockList([fakeSrcFile, pathFileInDir(fakeDestDir, 'a/b/afile'), pathFileInDir(fakeDestDir, 'anotherfile.json'), pathFileInDir(fakeDestDir, 'some/index.js')])
        const res = await storage.copy(fakeSrcFile, fakeDestDir)
        expect(res).toEqual([pathFileInDir(fakeDestDir, fakeSrcFile)])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest has one subdir with a file that has the same name as src and options.override is false (should be allowed)', async () => {
        const srcInDestDir = upath.join(fakeDestDir, upath.basename(fakeSrcFile))
        const srcInSubDestDir = upath.join(fakeDestDir, 'another-dir/', upath.basename(fakeSrcFile))
        setMockList([fakeSrcFile, srcInSubDestDir])
        const res = await storage.copy(fakeSrcFile, fakeDestDir)
        expect(res).toEqual([srcInDestDir])
      })
      test('when dest has one file with the same name as src and options.override is true', async () => {
        const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([ fakeSrcFile, srcInDestDir ])
        const res = await storage.copy(fakeSrcFile, fakeDestDir, { override: true })
        expect(res).toEqual([srcInDestDir])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('when dest contains one file with the same name as src and options.override is false', async () => {
        const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([ fakeSrcFile, srcInDestDir ])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestDir, { override: false })).toThrowFileExistsNoOverride()
      })

      test('when options.progressCallback function is set', async () => {
        const mockProgressCb = jest.fn()
        const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([ fakeSrcFile ])
        const res = await storage.copy(fakeSrcFile, fakeDestDir, { progressCallback: mockProgressCb })
        expect(res).toEqual([srcInDestDir])
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
        expect(mockProgressCb).toHaveBeenCalledTimes(1)
        expect(mockProgressCb).toHaveBeenCalledWith(srcInDestDir)
      })
    })
    describe('with src and dest being folders', () => {
      test('3 files (w/ subdirs) in src and dest is empty with progressCb', async () => {
        const mockProgressCb = jest.fn()
        // we want copy(a/dir/, another/dir2) to result into another/dir2/dir/*
        const files = ['a/file1.html', 'b/c/file2.css', 'file3']
        const destFiles = files.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
        setMockList(files.map(f => upath.join(fakeSrcDir, f)))
        const res = await storage.copy(fakeSrcDir, fakeDestDir, { progressCallback: mockProgressCb })
        expect(res).toEqual(destFiles)
        expect(mockAzureCopy).toHaveBeenCalledTimes(3)
        expect(mockProgressCb).toHaveBeenCalledTimes(3)
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[0])
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[1])
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[2])
      })
      test('3 files in src and 3 different files in dest and override is false', async () => {
        const files = ['a/file1.html', 'b/c/file2.css', 'file3']
        const filesDest = ['file4.html', 'file5.css', 'file6.js']
        setMockList(files.map(f => upath.join(fakeSrcDir, f)).concat(filesDest.map(f => upath.join(fakeDestDir, f))))
        const res = await storage.copy(fakeSrcDir, fakeDestDir, { override: false })
        expect(res).toEqual(files.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f))))
        expect(mockAzureCopy).toHaveBeenCalledTimes(3)
      })
      test('src base dir name already exists in dest with override true', async () => {
        const files = ['a/file1.html']
        const filesDest = ['a/file1.html', 'b/file2.html']
        setMockList(files.map(f => upath.join(fakeSrcDir, f)).concat(filesDest.map(f => upath.join(fakeDestDir, upath.basename(fakeSrcDir), f))))
        const res = await storage.copy(fakeSrcDir, fakeDestDir, { override: true })
        expect(res).toEqual(files.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f))))
        expect(mockAzureCopy).toHaveBeenCalledTimes(1)
      })
      test('1 file in src that already exist in dest with override false', async () => {
        const files = ['a/file1.html']
        const filesDest = ['a/file1.html', 'b/file2.html']
        setMockList(files.map(f => upath.join(fakeSrcDir, f)).concat(filesDest.map(f => upath.join(fakeDestDir, upath.basename(fakeSrcDir), f))))
        await expect(storage.copy.bind(storage, fakeSrcDir, fakeDestDir, { override: false })).toThrowFileExistsNoOverride()
      })
    })
    describe('with src being a folder and dest a file (allowed for remote locations)', () => {
      test('3 files in src and dest does not exist', async () => {
        // if we cp dir/ to file we get file/
        // as opposed to dir/ to dir2/ we would get dir/dir2/
        const files = ['a/file1.html', 'b/c/file2.css', 'file3']
        const destFiles = files.map(f => upath.join(fakeDestFile, f))
        setMockList(files.map(f => upath.join(fakeSrcDir, f)))
        const res = await storage.copy(fakeSrcDir, fakeDestFile)
        expect(res).toEqual(destFiles)
        expect(mockAzureCopy).toHaveBeenCalledTimes(3)
      })
      test('3 files in src and dest exists with override false (still allowed)', async () => {
        // if we cp dir/ to file we get file/
        // as opposed to dir/ to dir2/ we would get dir/dir2/
        const files = ['a/file1.html', 'b/c/file2.css', 'file3']
        const destFiles = files.map(f => upath.join(fakeDestFile, f))
        setMockList(files.map(f => upath.join(fakeSrcDir, f)).concat([fakeDestFile]))
        const res = await storage.copy(fakeSrcDir, fakeDestFile, { override: false })
        expect(res).toEqual(destFiles)
        expect(mockAzureCopy).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('from a local location to a remote location', () => {
    const fakeFs = global.fakeFs()
    beforeEach(() => {
      fakeFs.reset()
      fs.createReadStream.mockImplementation(fakeFs.createReadStream)
      fs.readdir.mockImplementation(fakeFs.readdir)
      fs.stat.mockImplementation(fakeFs.stat)
    })
    describe('with src and dest being files', () => {
      test('when source file does not exist', async () => {
        setMockList([fakeDestFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile, { localSrc: true })).toThrowFileNotExists(fakeSrcFile)
      })
      test('when dest does not exist', async () => {
        fakeFs.addFile(fakeSrcFile)
        setMockList([])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { localSrc: true })
        expect(res).toEqual([fakeDestFile])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(fakeDestFile)
        // enforce called with stream
        expect(mockWrite.mock.calls[0][1]).toBeInstanceOf(stream.Readable)
      })
      test('when dest does exist and override is true', async () => {
        fakeFs.addFile(fakeSrcFile)
        setMockList([fakeDestFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { localSrc: true, override: true })
        expect(res).toEqual([fakeDestFile])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(fakeDestFile)
      })
      test('when dest does exist and override is false', async () => {
        fakeFs.addFile(fakeSrcFile)
        setMockList([fakeDestFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile, { localSrc: true, override: false })).toThrowFileExistsNoOverride()
      })
      test('when options.progressCallback function is set', async () => {
        fakeFs.addFile(fakeSrcFile)
        const mockProgressCb = jest.fn()
        setMockList([])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { localSrc: true, progressCallback: mockProgressCb })
        expect(res).toEqual([fakeDestFile])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(fakeDestFile)
        expect(mockProgressCb).toHaveBeenCalledTimes(1)
        expect(mockProgressCb).toHaveBeenCalledWith(fakeDestFile)
      })
    })
    describe('with src being a file and dest being a folder', () => {
      test('when dest is empty', async () => {
        fakeFs.addFile(fakeSrcFile)
        const destFile = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([])
        const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true })
        expect(res).toEqual([destFile])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(destFile)
        // enforce called with stream
        expect(mockWrite.mock.calls[0][1]).toBeInstanceOf(stream.Readable)
      })
      test('when dest has one subdir with a file that has the same name as src and options.override is false (should be allowed)', async () => {
        fakeFs.addFile(fakeSrcFile)
        const srcInDestDir = upath.join(fakeDestDir, upath.basename(fakeSrcFile))
        const srcInSubDestDir = upath.join(fakeDestDir, 'another-dir/', upath.basename(fakeSrcFile))
        setMockList([srcInSubDestDir])
        const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true, override: false })
        expect(res).toEqual([srcInDestDir])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(srcInDestDir)
      })
      test('when dest has one file with the same name as src and options.override is true', async () => {
        fakeFs.addFile(fakeSrcFile)
        const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([ srcInDestDir ])
        const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true, override: true })
        expect(res).toEqual([srcInDestDir])
        expect(mockWrite).toHaveBeenCalledTimes(1)
        expect(mockWrite.mock.calls[0][0]).toEqual(srcInDestDir)
      })
      test('when dest contains one file with the same name as src and options.override is false', async () => {
        fakeFs.addFile(fakeSrcFile)
        const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
        setMockList([ srcInDestDir ])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestDir, { localSrc: true, override: false })).toThrowFileExistsNoOverride()
      })
    })
    describe('with src and dest being folders', () => {
      test('3 files (w/ subdirs) in src and dest is empty with progressCb', async () => {
        const mockProgressCb = jest.fn()
        const files = ['a/file1.html', 'b/c/file2.css', 'file3']
        files.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
        const destFiles = files.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
        setMockList([])
        const res = await storage.copy(fakeSrcDir, fakeDestDir, { progressCallback: mockProgressCb, localSrc: true })
        expect(res).toEqual(destFiles)
        expect(mockWrite).toHaveBeenCalledTimes(3)
        expect(mockWrite.mock.calls[0][1]).toBeInstanceOf(stream.Readable)
        expect(mockProgressCb).toHaveBeenCalledTimes(3)
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[0])
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[1])
        expect(mockProgressCb).toHaveBeenCalledWith(destFiles[2])
      })
      test('src base dir name already exists in dest with override true', async () => {
        const srcFiles = ['a/file1.html', 'file2.html']
        const filesInDest = ['a/file1.html'].map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
        srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
        setMockList(filesInDest)
        const cpDestFiles = srcFiles.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
        const res = await storage.copy(fakeSrcDir, fakeDestDir, { localSrc: true, override: true })
        expect(res).toEqual(cpDestFiles)
        expect(mockWrite).toHaveBeenCalledTimes(2)
      })
      test('src base dir name already exists in dest with override false', async () => {
        const srcFiles = ['a/file1.html']
        const filesInDest = ['a/file1.html'].map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
        srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
        setMockList(filesInDest)
        await expect(storage.copy.bind(storage, fakeSrcDir, fakeDestDir, { localSrc: true, override: false })).toThrowFileExistsNoOverride()
      })
    })

    describe('with src being a folder and dest a file (allowed for remote locations)', () => {
      test('3 files in src and dest does not exist', async () => {
        const srcFiles = ['a/file1.html', 'file2.html', 'file3']
        srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
        setMockList([])
        const cpDestFiles = srcFiles.map(f => upath.join(fakeDestFile, f))
        const res = await storage.copy(fakeSrcDir, fakeDestFile, { localSrc: true })
        expect(res).toEqual(cpDestFiles)
        expect(mockWrite).toHaveBeenCalledTimes(3)
      })
      test('3 files in src and dest exists with override false (still allowed)', async () => {
        // if we cp dir/ to file we get file/
        // as opposed to dir/ to dir2/ we would get dir/dir2/
        const srcFiles = ['a/file1.html', 'file2.html', 'file3']
        srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
        const cpDestFiles = srcFiles.map(f => upath.join(fakeDestFile, f))
        setMockList([fakeDestFile])
        const res = await storage.copy(fakeSrcDir, fakeDestFile, { localSrc: true, override: false })
        expect(res).toEqual(cpDestFiles)
        expect(mockWrite).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('from a remote location to a local location', () => {
    const fakeFs = global.fakeFs()
    beforeEach(() => {
      fakeFs.reset()
      fs.createWriteStream.mockReturnValue(new stream.Writable({ write: (chunk, enc, next) => { next() } }))
      fs.readdir.mockImplementation(fakeFs.readdir)
      fs.stat.mockImplementation(fakeFs.stat)
      mockCreateReadStream.mockResolvedValue(global.createStream('hello'))
    })
    describe('with src and dest being files', () => {
      test('when source file does not exist', async () => {
        setMockList([])
        fakeFs.addFile(fakeDestFile)
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile, { localDest: true })).toThrowFileNotExists(fakeSrcFile)
      })
      test('when dest does not exist', async () => {
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { localDest: true })
        expect(res).toEqual([upath.resolve(fakeDestFile)])
        expect(mockCreateReadStream).toHaveBeenCalledTimes(1)
        expect(mockCreateReadStream.mock.calls[0][0]).toEqual(fakeSrcFile)
        expect(fs.createWriteStream).toHaveBeenCalledTimes(1)
      })
      test('when dest does exist and override is true', async () => {
        fakeFs.addFile(fakeDestFile)
        setMockList([fakeSrcFile])
        const res = await storage.copy(fakeSrcFile, fakeDestFile, { localDest: true, override: true })
        expect(res).toEqual([upath.resolve(fakeDestFile)])
        expect(mockCreateReadStream).toHaveBeenCalledTimes(1)
        expect(mockCreateReadStream.mock.calls[0][0]).toEqual(fakeSrcFile)
        expect(fs.createWriteStream).toHaveBeenCalledTimes(1)
      })
      test('when dest does exist and override is false', async () => {
        fakeFs.addFile(fakeDestFile)
        setMockList([fakeSrcFile])
        await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestFile, { localDest: true, override: false })).toThrowFileExistsNoOverride()
      })
    })
  })
  // describe('with src being a file and dest being a folder', () => {
  //   test('when dest is empty', async () => {
  //     fakeFs.addFile(fakeSrcFile)
  //     const destFile = pathFileInDir(fakeDestDir, fakeSrcFile)
  //     setMockList([])
  //     const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true })
  //     expect(res).toEqual([destFile])
  //     expect(mockWrite).toHaveBeenCalledTimes(1)
  //     expect(mockWrite.mock.calls[0][0]).toEqual(destFile)
  //     // enforce called with stream
  //     expect(mockWrite.mock.calls[0][1]).toBeInstanceOf(stream.Readable)
  //   })
  //   test('when dest has one subdir with a file that has the same name as src and options.override is false (should be allowed)', async () => {
  //     fakeFs.addFile(fakeSrcFile)
  //     const srcInDestDir = upath.join(fakeDestDir, upath.basename(fakeSrcFile))
  //     const srcInSubDestDir = upath.join(fakeDestDir, 'another-dir/', upath.basename(fakeSrcFile))
  //     setMockList([srcInSubDestDir])
  //     const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true, override: false })
  //     expect(res).toEqual([srcInDestDir])
  //     expect(mockWrite).toHaveBeenCalledTimes(1)
  //     expect(mockWrite.mock.calls[0][0]).toEqual(srcInDestDir)
  //   })
  //   test('when dest has one file with the same name as src and options.override is true', async () => {
  //     fakeFs.addFile(fakeSrcFile)
  //     const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
  //     setMockList([ srcInDestDir ])
  //     const res = await storage.copy(fakeSrcFile, fakeDestDir, { localSrc: true, override: true })
  //     expect(res).toEqual([srcInDestDir])
  //     expect(mockWrite).toHaveBeenCalledTimes(1)
  //     expect(mockWrite.mock.calls[0][0]).toEqual(srcInDestDir)
  //   })
  //   test('when dest contains one file with the same name as src and options.override is false', async () => {
  //     fakeFs.addFile(fakeSrcFile)
  //     const srcInDestDir = pathFileInDir(fakeDestDir, fakeSrcFile)
  //     setMockList([ srcInDestDir ])
  //     await expect(storage.copy.bind(storage, fakeSrcFile, fakeDestDir, { localSrc: true, override: false })).toThrowFileExistsNoOverride()
  //   })
  // })
  // describe('with src and dest being folders', () => {
  //   test('3 files (w/ subdirs) in src and dest is empty with progressCb', async () => {
  //     const mockProgressCb = jest.fn()
  //     const files = ['a/file1.html', 'b/c/file2.css', 'file3']
  //     files.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
  //     const destFiles = files.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
  //     setMockList([])
  //     const res = await storage.copy(fakeSrcDir, fakeDestDir, { progressCallback: mockProgressCb, localSrc: true })
  //     expect(res).toEqual(destFiles)
  //     expect(mockWrite).toHaveBeenCalledTimes(3)
  //     expect(mockWrite.mock.calls[0][1]).toBeInstanceOf(stream.Readable)
  //     expect(mockProgressCb).toHaveBeenCalledTimes(3)
  //     expect(mockProgressCb).toHaveBeenCalledWith(destFiles[0])
  //     expect(mockProgressCb).toHaveBeenCalledWith(destFiles[1])
  //     expect(mockProgressCb).toHaveBeenCalledWith(destFiles[2])
  //   })
  //   test('src base dir name already exists in dest with override true', async () => {
  //     const srcFiles = ['a/file1.html', 'file2.html']
  //     const filesInDest = ['a/file1.html'].map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
  //     srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
  //     setMockList(filesInDest)
  //     const cpDestFiles = srcFiles.map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
  //     const res = await storage.copy(fakeSrcDir, fakeDestDir, { localSrc: true, override: true })
  //     expect(res).toEqual(cpDestFiles)
  //     expect(mockWrite).toHaveBeenCalledTimes(2)
  //   })
  //   test('src base dir name already exists in dest with override false', async () => {
  //     const srcFiles = ['a/file1.html']
  //     const filesInDest = ['a/file1.html'].map(f => upath.join(fakeDestDir, upath.join(upath.basename(fakeSrcDir), f)))
  //     srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
  //     setMockList(filesInDest)
  //     await expect(storage.copy.bind(storage, fakeSrcDir, fakeDestDir, { localSrc: true, override: false })).toThrowFileExistsNoOverride()
  //   })
  // })

  // describe('with src being a folder and dest a file (allowed for remote locations)', () => {
  //   test('3 files in src and dest does not exist', async () => {
  //     const srcFiles = ['a/file1.html', 'file2.html', 'file3']
  //     srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
  //     setMockList([])
  //     const cpDestFiles = srcFiles.map(f => upath.join(fakeDestFile, f))
  //     const res = await storage.copy(fakeSrcDir, fakeDestFile, { localSrc: true })
  //     expect(res).toEqual(cpDestFiles)
  //     expect(mockWrite).toHaveBeenCalledTimes(3)
  //   })
  //   test('3 files in src and dest exists with override false (still allowed)', async () => {
  //     // if we cp dir/ to file we get file/
  //     // as opposed to dir/ to dir2/ we would get dir/dir2/
  //     const srcFiles = ['a/file1.html', 'file2.html', 'file3']
  //     srcFiles.map(f => upath.join(fakeSrcDir, f)).forEach(f => fakeFs.addFile(f, 'hello'))
  //     const cpDestFiles = srcFiles.map(f => upath.join(fakeDestFile, f))
  //     setMockList([fakeDestFile])
  //     const res = await storage.copy(fakeSrcDir, fakeDestFile, { localSrc: true, override: false })
  //     expect(res).toEqual(cpDestFiles)
  //     expect(mockWrite).toHaveBeenCalledTimes(3)
  //   })
  // })
  // })
})
