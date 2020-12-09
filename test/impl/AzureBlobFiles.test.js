/* eslint-disable jest/expect-expect */
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
const fetch = require('node-fetch')
jest.mock('node-fetch', () => jest.fn())
const fakeResponse = jest.fn()

jest.mock('uuid', () => ({ v4: () => 'fake-uuid' }))

const { AzureBlobFiles } = require('../../lib/impl/AzureBlobFiles')
const stream = require('stream')
const cloneDeep = require('lodash.clonedeep')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const fakeSASCredentials = {
  sasURLPrivate: 'https://fake.com/private?secret=abcd',
  sasURLPublic: 'https://fake.com/public?secret=abcd'
}
const fakeUserCredentials = {
  containerName: 'fake',
  storageAccessKey: 'fakeKey',
  storageAccount: 'fakeAccount'
}

const fakeAccessPolicy = '<?xml version="1.0" encoding="utf-8"?><SignedIdentifiers><SignedIdentifier><Id>fakepolicy</Id><permissions></permissions></SignedIdentifier></SignedIdentifiers>'
const fakeEmptyAccessPolicy = '<?xml version="1.0" encoding="utf-8"?><SignedIdentifiers></SignedIdentifiers>'
const fakeEmptyAccessPolicy1 = '<?xml version="1.0" encoding="utf-8"?>'
const fakeAborter = 'fakeAborter'

const DEFAULT_CDN_STORAGE_HOST = 'https://firefly.azureedge.net'

beforeEach(async () => {
  expect.hasAssertions()
  jest.clearAllMocks()
})

const testWithProviderError = async (boundFunc, providerMock, errorDetails, file404) => {
  errorDetails = cloneDeep(errorDetails)
  if (file404) {
    providerMock.mockRejectedValue({ response: { status: 404 } })
    await global.expectToThrowFileNotExists(boundFunc, file404, errorDetails)
  }
  // 403
  providerMock.mockRejectedValue({ response: { status: 403 } })
  await global.expectToThrowBadCredentials(boundFunc, errorDetails, 'storage service')
  // unknown status 444
  let error = { response: { status: 444 }, somefield: true }
  providerMock.mockRejectedValue(error)
  await global.expectToThrowInternalWithStatus(boundFunc, 444, { ...errorDetails, _internal: error })
  // no status Error
  error = new Error('some fake error')
  providerMock.mockRejectedValue(error)
  await global.expectToThrowInternal(boundFunc, { ...errorDetails, _internal: error })
}

describe('init', () => {
  const fakeAzureAborter = 'fakeAborter'
  const mockContainerCreateIfNotExists = jest.fn()
  const mockSetAccessPolicy = jest.fn()
  const mockContainerClientInstance = {
    createIfNotExists: mockContainerCreateIfNotExists,
    setAccessPolicy: mockSetAccessPolicy,
    url: fakeSASCredentials.sasURLPrivate
  }
  beforeEach(async () => {
    mockContainerCreateIfNotExists.mockReset()
    mockSetAccessPolicy.mockReset()
    azure.StorageSharedKeyCredential = jest.fn()
    azure.AnonymousCredential = jest.fn()
    azure.BlobServiceClient.mockImplementation(() => {
      return {
        getContainerClient: jest.fn(() => mockContainerClientInstance)
      }
    })
    azure.ContainerClient.mockImplementation(() => mockContainerClientInstance)
  })

  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('with bad args', () => {
    // eslint-disable-next-line jest/expect-expect
    test('when called with no arguments', async () => {
      await global.expectToThrowBadArg(AzureBlobFiles.init, ['credentials', 'at least'], {})
    })

    // eslint-disable-next-line jest/expect-expect
    test('when called with incomplete SAS credentials', async () => {
      const badInput = { ...fakeSASCredentials }
      delete badInput.sasURLPrivate
      const details = { sasURLPublic: fakeSASCredentials.sasURLPublic.split('?')[0] + '?<hidden>' } // hide token part of SAS in error details
      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, badInput), ['credentials', 'required', 'sasURLPrivate'], details)
    })

    // eslint-disable-next-line jest/expect-expect
    test('when called with incomplete user credentials', async () => {
      const badInput = { ...fakeUserCredentials }
      delete badInput.containerName
      const details = { storageAccount: fakeUserCredentials.storageAccount, storageAccessKey: '<hidden>' }
      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, badInput), ['credentials', 'required', 'containerName'], details)
    })

    // eslint-disable-next-line jest/expect-expect
    test('when called with both sas and user credentials', async () => {
      const fakeErrorDetails = cloneDeep({ ...fakeUserCredentials, ...fakeSASCredentials })
      fakeErrorDetails.sasURLPublic = fakeErrorDetails.sasURLPublic.split('?')[0] + '?<hidden>'
      fakeErrorDetails.sasURLPrivate = fakeErrorDetails.sasURLPrivate.split('?')[0] + '?<hidden>'
      fakeErrorDetails.storageAccessKey = '<hidden>'

      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, { ...fakeUserCredentials, ...fakeSASCredentials }), ['credentials', 'conflict'], fakeErrorDetails)
    })
  })

  describe('with azure storage account credentials', () => {
    beforeEach(async () => {
      fetch.mockResolvedValue({
        text: fakeResponse
      })
      fakeResponse.mockResolvedValue(fakeAccessPolicy)
      mockContainerCreateIfNotExists.mockResolvedValue('all good')
    })

    test('when createIfNotExists containers does not fail', async () => {
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockContainerCreateIfNotExists).toHaveBeenCalledTimes(2)
      expect(mockContainerCreateIfNotExists).toHaveBeenCalledWith()
      expect(mockContainerCreateIfNotExists).toHaveBeenCalledWith({ access: 'blob' })
      checkInitDebugLogNoSecrets(fakeUserCredentials.storageAccessKey)
    })

    test('when createIfNotExists container API call fails', async () =>
      testWithProviderError(
        AzureBlobFiles.init.bind(null, fakeUserCredentials),
        mockContainerCreateIfNotExists,
        {
          containerName: fakeUserCredentials.containerName,
          storageAccount: fakeUserCredentials.storageAccount
        }
      )
    )

    test('when there is no access policy defined yet', async () => {
      fakeResponse.mockResolvedValueOnce(fakeEmptyAccessPolicy)
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockSetAccessPolicy).toHaveBeenCalledWith(undefined, [{ id: 'fake-uuid', accessPolicy: { permission: '' } }])
    })
    test('when there is an empty access policy already defined', async () => {
      fakeResponse.mockResolvedValueOnce(fakeEmptyAccessPolicy)
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockSetAccessPolicy).toHaveBeenCalledWith(undefined, [{ id: 'fake-uuid', accessPolicy: { permission: '' } }])
    })
    test('when there is an empty access policy already defined (2)', async () => {
      fakeResponse.mockResolvedValueOnce(fakeEmptyAccessPolicy1)
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockSetAccessPolicy).toHaveBeenCalledWith(undefined, [{ id: 'fake-uuid', accessPolicy: { permission: '' } }])
    })
    test('when there is a valid access policy already defined', async () => {
      fakeResponse.mockResolvedValueOnce(fakeAccessPolicy)
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockSetAccessPolicy).toHaveBeenCalledTimes(0)
    })
  })

  test('with azure SAS credentials', async () => {
    // test
    const files = await AzureBlobFiles.init(fakeSASCredentials)
    expect(mockSetAccessPolicy).not.toHaveBeenCalled()
    expect(mockContainerCreateIfNotExists).not.toHaveBeenCalled()
    expect(files).toBeInstanceOf(AzureBlobFiles)
    checkInitDebugLogNoSecrets(fakeSASCredentials.sasURLPublic)
    checkInitDebugLogNoSecrets(fakeSASCredentials.sasURLPrivate)
  })
})

// describe('_fileExists', () => {
//   const mockBlobGetProperties = jest.fn()

//   const fileInPrivateDir = 'dir/inadir/file.html'
//   const fileInRoot = 'afile.html'
//   const fileInPublicDir = 'public/afile.html'
//   const fileInPublicSubDir = 'public/sub/afile.html'
//   const fileWithoutExtension = 'afile'
//   const fakeAzureFileProps = { fake: 'props' }

//   let files

//   beforeEach(async () => {
//     mockBlobGetProperties.mockReset()
//     azure.ContainerClient = jest.fn()
//     azure.BlockBlobClient.fromContainerURL = jest.fn().mockReturnValue({ getProperties: mockBlobGetProperties })
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   const expectExists = async (exists) => {
//     exists ? mockBlobGetProperties.mockResolvedValue(fakeAzureFileProps) : mockBlobGetProperties.mockRejectedValue({ response: { status: 404 } })
//     expect(await files._fileExists(fileInPrivateDir)).toEqual(exists)
//     expect(await files._fileExists(fileInRoot)).toEqual(exists)
//     expect(await files._fileExists(fileInPublicDir)).toEqual(exists)
//     expect(await files._fileExists(fileInPublicSubDir)).toEqual(exists)
//     expect(await files._fileExists(fileWithoutExtension)).toEqual(exists)
//     expect(mockBlobGetProperties).toHaveBeenCalled()
//   }

//   test('when it exists', async () => expectExists(true)) // eslint-disable-line jest/expect-expect
//   test('when it does not exists', async () => expectExists(false)) // eslint-disable-line jest/expect-expect

//   // eslint-disable-next-line jest/expect-expect
//   test('when there is a provider error on azure.BlockBlobClient.getProperties',
//     async () => testWithProviderError(files._fileExists.bind(files, fileInPrivateDir), mockBlobGetProperties, { filePath: fileInPrivateDir })
//   )
// })

describe('getFileInfo', () => {
  let files
  const fileName = 'path.html'
  const fakeFileInfo = {
    lastModified: Date.now(),
    etag: 'asdasd',
    contentLength: 100,
    contentType: 'test/junk'
  }
  const mockBlobGetProperties = jest.fn()
  beforeEach(async () => {
    mockBlobGetProperties.mockReset()
    mockBlobGetProperties.mockResolvedValue(fakeFileInfo)

    azure.ContainerClient.mockImplementation(() => ({
      getBlockBlobClient: () => ({
        getProperties: mockBlobGetProperties
      })
    }))

    files = await AzureBlobFiles.init(fakeSASCredentials)

    files._getUrl = () => {
      return 'duke of url'
    }
  })

  test('when the file exists', async () => {
    const fileInfo = await files.getFileInfo(fileName)
    expect(fileInfo).toEqual({ isDirectory: false, isPublic: false, url: 'duke of url', name: fileName, ...fakeFileInfo })
  })

  test('when the file does not exist', async () => {
    mockBlobGetProperties.mockRejectedValue({ response: { status: 404 } })
    await expect(files.getFileInfo(fileName)).rejects.toThrow('[FilesLib:ERROR_FILE_NOT_EXISTS] file `path.html` does not exist')
  })

  test('when the azure.blob.getProperties fails', async () =>
    testWithProviderError(
      () => files.getFileInfo(fileName),
      mockBlobGetProperties,
      {
        filePath: fileName
      }
    )
  )
})

describe('_listFolder', () => {
  const privateDir = 'some/private/dir/'
  const publicDir = 'public/some/dir/'

  const fakeAzureListResponse = (files) => {
    const asyncIterable = files.map(name => ({
      name,
      properties: {
        lastModified: Date.now(),
        createdOn: Date.now(),
        etag: 'asdasd',
        contentLength: 100,
        contentType: 'test/junk',
        url: 'some/url?asdklk'
      }
    }))
    asyncIterable[Symbol.asyncIterator] = async function * () {
      for (let i = 0; i < asyncIterable.length; i++) {
        yield { ...asyncIterable[i] }
      }
    }
    return asyncIterable
  }

  const mockContainerPublicList = jest.fn()
  const mockContainerPrivateList = jest.fn()

  const fakeFiles = ['file1', 'subdir/file2', 'another/subdir/file3']
  const fakeFiles2 = ['file4', 'subdir2/file5', 'another2/subdir3/file6']
  const multiFakeFiles = [['file1', 'subdir/file2', 'another/subdir/file3'], ['file4', 'subdir/file5', 'another/subdir/file6'], ['file7']]

  let files

  beforeEach(async () => {
    mockContainerPublicList.mockReset()
    mockContainerPrivateList.mockReset()
    azure.ContainerClient.mockImplementation(url => {
      const containerMockList = url.includes('public') ? mockContainerPublicList : mockContainerPrivateList
      return {
        listBlobsFlat: containerMockList,
        getBlockBlobClient: () => ({
          url: 'some/url?asdklk'
        })
      }
    })

    files = await AzureBlobFiles.init(fakeSASCredentials)
  })

  // eslint-disable-next-line jsdoc/require-jsdoc
  async function testListFolder (filePath, listsPublic, listsPrivate, isRoot) {
    const publicFiles = fakeFiles.map(f => publicDir + f)
    const privateFiles = fakeFiles2.map(f => privateDir + f)
    mockContainerPublicList.mockReturnValue(fakeAzureListResponse(publicFiles))
    mockContainerPrivateList.mockReturnValue(fakeAzureListResponse(privateFiles))

    const fileList = await files._listFolder(filePath)
    expect(fileList).toStrictEqual(expect.arrayContaining([expect.objectContaining({ name: expect.any(String) })]))
    // expect length of returned list to equal sum
    expect(fileList.length).toBe((listsPublic ? publicFiles.length : 0) + (listsPrivate ? privateFiles.length : 0))

    expect(mockContainerPublicList).toHaveBeenCalledTimes(listsPublic ? 1 : 0)
    expect(mockContainerPrivateList).toHaveBeenCalledTimes(listsPrivate ? 1 : 0)

    if (listsPublic) {
      expect(mockContainerPublicList).toHaveBeenCalledWith({ prefix: isRoot ? 'public' : filePath })
    }

    if (listsPrivate) {
      expect(mockContainerPrivateList).toHaveBeenCalledWith({ prefix: filePath })
    }
  }

  test('when it is the root (empty string)', async () => {
    await testListFolder('', true, true, true)
  })

  test('when it is private', async () => {
    await testListFolder(privateDir, false, true)
  })

  test('when it is public', async () => {
    await testListFolder(publicDir, true, false)
  })
  // can't do error handling on returned async iteerable for now
  // ('when azure.ContainerClient.list rejects with an error', async () =>
  //   testWithProviderError(files._listFolder.bind(files, publicDir), mockContainerPublicList, { filePath: publicDir })
  // )
})

// describe('_deleteFile', () => {
//   const mockAzureDelete = jest.fn()
//   let files

//   beforeEach(async () => {
//     mockAzureDelete.mockReset()

//     azure.ContainerClient = jest.fn()
//     azure.BlockBlobClient.fromContainerURL = jest.fn().mockReturnValue({ delete: mockAzureDelete })
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   test('a file that exists', async () => {
//     mockAzureDelete.mockResolvedValue(true)
//     await files._deleteFile('afile')
//     expect(mockAzureDelete).toHaveBeenCalledTimes(1)
//   })

//   // also checks 404 (note the double 'afile')
//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.BlockBlobClient.delete rejects with an error, including file not exists (404)', async () =>
//     testWithProviderError(files._deleteFile.bind(files, 'afile'), mockAzureDelete, { filePath: 'afile' }, 'afile'))
// })

// describe('_createReadStream', () => {
//   const fakeFile = 'a/dir/file1'
//   const mockAzureDownload = jest.fn()
//   let files

//   beforeEach(async () => {
//     mockAzureDownload.mockReset()
//     azure.BlockBlobClient.fromContainerURL = jest.fn().mockReturnValue({ download: mockAzureDownload })
//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   let fakeRdStream
//   const fakeOptions = { position: 1, length: 10 }

//   beforeEach(() => {
//     fakeRdStream = new stream.Readable()
//     fakeRdStream.push(null)
//     mockAzureDownload.mockResolvedValue({ readableStreamBody: fakeRdStream })
//   })

//   test('w default options ({ position: 0, length: undefined })', async () => {
//     const res = await files._createReadStream(fakeFile, { position: 0 })
//     expect(res).toBe(fakeRdStream)
//     expect(mockAzureDownload).toHaveBeenCalledTimes(1)
//     expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, 0, undefined)
//   })

//   test('with options', async () => {
//     const res = await files._createReadStream(fakeFile, fakeOptions)
//     expect(res).toBe(fakeRdStream)
//     expect(mockAzureDownload).toHaveBeenCalledTimes(1)
//     expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, fakeOptions.position, fakeOptions.length)
//   })

//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.BlockBlobClient.download rejects with an error, including file not exists (404)', async () =>
//     testWithProviderError(files._createReadStream.bind(files, 'afile', {}), mockAzureDownload, { filePath: 'afile', options: {} }, 'afile')
//   )

//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.BlockBlobClient.download rejects with a 416 error because of out of range position', async () => {
//     mockAzureDownload.mockRejectedValue({ response: { status: 416 } })
//     await global.expectToThrowBadPosition(files._createReadStream.bind(files, 'afile', { position: 1234 }), 1234, 'afile', { filePath: 'afile', options: { position: 1234 } })
//   })
// })

// describe('_writeBuffer', () => {
//   const fakeFile = 'a/dir/file1'
//   const mockAzureUpload = jest.fn()
//   const fakeBuffer = Buffer.from('some fake content @#$%^&*()@!12-=][;"\n\trewq')
//   let files

//   beforeEach(async () => {
//     mockAzureUpload.mockReset()
//     mockAzureUpload.mockResolvedValue(true)
//     azure.BlockBlobClient.fromContainerURL = jest.fn().mockReturnValue({ upload: mockAzureUpload })
//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   const testWriteBuffer = (fileExt, expectMimeType) => async () => {
//     const res = await files._writeBuffer(fakeFile + fileExt, fakeBuffer)
//     expect(res).toBe(fakeBuffer.length)
//     expect(mockAzureUpload).toHaveBeenCalledTimes(1)
//     expect(mockAzureUpload).toHaveBeenCalledWith(fakeAborter, fakeBuffer, fakeBuffer.length, { blobHTTPHeaders: { blobContentType: expectMimeType } })
//   }

//   test('when file has valid mime type file extension', testWriteBuffer('.json', 'application/json')) // eslint-disable-line jest/expect-expect
//   test('when file has invalid mime type file extension', testWriteBuffer('.iiiiiiiii', 'application/octet-stream')) // eslint-disable-line jest/expect-expect
//   test('when file has no file extension', testWriteBuffer('', 'application/octet-stream')) // eslint-disable-line jest/expect-expect

//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.BlockBlobClient throws an error', async () =>
//     testWithProviderError(files._writeBuffer.bind(files, 'afile', fakeBuffer), mockAzureUpload, { filePath: 'afile', contentType: 'Buffer' })
//   )
// })

// describe('_writeStream', () => {
//   const fakeFile = 'a/dir/file1'
//   const mockAzureStreamUpload = jest.fn()
//   const fakeContent = 'some fake content @#$%^&*()@!12-=][;"\n\trewq'
//   let fakeRdStream
//   let files

//   beforeEach(async () => {
//     mockAzureStreamUpload.mockReset()
//     mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
//     azure.uploadStreamToBlockBlob = mockAzureStreamUpload
//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//     fakeRdStream = new stream.Readable()
//     fakeRdStream.push(fakeContent)
//     fakeRdStream.push(null)
//   })

//   const testWriteStream = (fileExt, expectMimeType) => async () => {
//     const res = await files._writeStream(fakeFile + fileExt, fakeRdStream)
//     expect(res).toBe(fakeContent.length)
//     expect(mockAzureStreamUpload).toHaveBeenCalledTimes(1)
//     expect(mockAzureStreamUpload.mock.calls[0]).toEqual(expect.arrayContaining([fakeRdStream, { blobHTTPHeaders: { blobContentType: expectMimeType } }]))
//   }

//   test('when file has valid mime type file extension', testWriteStream('.json', 'application/json')) // eslint-disable-line jest/expect-expect
//   test('when file has invalid mime type file extension', testWriteStream('.iiiiiiiii', 'application/octet-stream')) // eslint-disable-line jest/expect-expect
//   test('when file has no file extension', testWriteStream('', 'application/octet-stream')) // eslint-disable-line jest/expect-expect

//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.uploadStreamToBlockBlob throws an error', async () =>
//     testWithProviderError(files._writeStream.bind(files, 'afile', fakeRdStream), mockAzureStreamUpload, { filePath: 'afile', contentType: 'Readable' }))
// })

// describe('_createWriteStream', () => {
//   const mockAzureStreamUpload = jest.fn()

//   const fakeFile = 'a/dir/file1'
//   const fakeChunks = ['some ', 'fake con', 'tent @#$%^&*()@!', '12-=][;"\n\trewq']
//   const fakeChunksSize = fakeChunks.reduce((prev, curr) => prev + curr.length, 0)

//   /** @type {AzureBlobFiles} */
//   let files

//   beforeEach(async () => {
//     mockAzureStreamUpload.mockReset()
//     mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
//     azure.uploadStreamToBlockBlob = mockAzureStreamUpload
//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   test('with file with html extension, write multiple chunks and end the stream', async () => {
//     expect.assertions(5)
//     const wrStream = await files._createWriteStream(fakeFile + '.html')
//     expect(wrStream).toBeInstanceOf(stream.Writable)
//     fakeChunks.forEach(chunk => wrStream.write(chunk))
//     wrStream.end()
//     return new Promise(resolve => {
//       wrStream.on('finish', async bytesWritten => {
//         expect(bytesWritten).toEqual(fakeChunksSize)
//         // also check field
//         expect(wrStream.bytesWritten).toEqual(fakeChunksSize)
//         expect(mockAzureStreamUpload).toHaveBeenCalledTimes(1)
//         expect(mockAzureStreamUpload.mock.calls[0]).toEqual(expect.arrayContaining([{ blobHTTPHeaders: { blobContentType: 'text/html' } }]))
//         resolve()
//       })
//     })
//   })

//   // eslint-disable-next-line jest/expect-expect
//   test('when stream is written and azure.uploadStreamToBlockBlob rejects an error', async () => {
//     mockAzureStreamUpload.mockRejectedValue({ response: { status: 444 } })
//     const wrStream = await files._createWriteStream(fakeFile)
//     wrStream.write('hi')
//     return new Promise(resolve => {
//       wrStream.on('error', async e => {
//         await global.expectToThrowInternalWithStatus(() => { throw e }, 444, { filePath: fakeFile, _internal: { response: { status: 444 } } })
//         resolve()
//       })
//     })
//   })

//   // eslint-disable-next-line jest/expect-expect
//   test('when stream is written and azure.uploadStreamToBlockBlob rejects with 403', async () => {
//     mockAzureStreamUpload.mockRejectedValue({ response: { status: 403 } })
//     const wrStream = await files._createWriteStream(fakeFile)
//     wrStream.write('hi')
//     return new Promise(resolve => {
//       wrStream.on('error', async e => {
//         await global.expectToThrowBadCredentials(() => { throw e }, { filePath: fakeFile }, 'storage service')
//         resolve()
//       })
//     })
//   })
// })

// describe('_copyRemoteToRemoteFile', () => {
//   const mockStartCopyFromURL = jest.fn()

//   const src = 'a/dir/file1'
//   const dest = 'public/another/dir/file2'
//   const fakeSrcURL = 'https://fake.blob.core.windows.net/a/dir/file1?secret=xxx'// important to keep secret

//   /** @type {AzureBlobFiles} */
//   let files

//   beforeEach(async () => {
//     mockStartCopyFromURL.mockReset()
//     mockStartCopyFromURL.mockResolvedValue(true)
//     azure.BlockBlobClient.fromContainerURL = jest.fn().mockReturnValue({ startCopyFromURL: mockStartCopyFromURL, url: fakeSrcURL })
//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//
//   })

//   test('when source file exists', async () => {
//     await files._copyRemoteToRemoteFile(src, dest)
//     expect(mockStartCopyFromURL).toHaveBeenCalledTimes(1)
//     expect(mockStartCopyFromURL.mock.calls[0]).toEqual(expect.arrayContaining([fakeSrcURL]))
//   })

//   // eslint-disable-next-line jest/expect-expect
//   test('when azure.uploadStreamToBlockBlob throws an error', async () =>
//     testWithProviderError(files._copyRemoteToRemoteFile.bind(files, src, dest), mockStartCopyFromURL, { srcPath: src, destPath: dest }, src))
// })

// describe('_getUrl', () => {
//   const fakeAzureAborter = 'fakeAborter'
//   const mockContainerCreateIfNotExists = jest.fn()

//   const mockBlockBlob = jest.fn()
//   const setMockBlobUrl = url => {
//     azure.BlockBlobClient.fromContainerURL = mockBlockBlob.mockReturnValue({ url })
//   }

//   const tvm = jest.fn()

//   /** @type {AzureBlobFiles} */
//   let files

//   beforeEach(async () => {
//     mockBlockBlob.mockReset()

//     tvm.getAzureBlobPresignCredentials = jest.fn()
//     tvm.getAzureBlobPresignCredentials.mockResolvedValue({
//       signature: 'fakesign'
//     })

//     azure.ContainerClient = jest.fn()
//     files = await AzureBlobFiles.init(fakeSASCredentials, tvm)
//

//     mockContainerCreateIfNotExists.mockReset()
//     azure.ContainerClient = { fromServiceURL: jest.fn() }
//     azure.Aborter = { none: fakeAzureAborter }
//     azure.ContainerClient.fromServiceURL.mockReturnValue({ create: mockContainerCreateIfNotExists })
//   })

//   test('url with no query args', async () => {
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = DEFAULT_CDN_STORAGE_HOST + '/fake/fakesub/afile'
//     const url = files._getUrl('fakesub/afile')
//     expect(url).toEqual(expectedUrl)
//   })

//   test('url with query args', async () => {
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl + '?password=xxxx&user=username')
//     const expectedUrl = DEFAULT_CDN_STORAGE_HOST + '/fake/fakesub/afile'
//     const url = files._getUrl('fakesub/afile')
//     expect(url).toEqual(expectedUrl)
//   })

//   test('test _getUrl custom host', async () => {
//     files = new AzureBlobFiles({ ...fakeUserCredentials, hostName: 'fakeHost' }, null)
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = 'https://fakeHost/fake/fakesub/afile'
//     const url = files._getUrl('fakesub/afile')
//     expect(url).toEqual(expectedUrl)
//   })
// })

// describe('_getPresignUrl', () => {
//   const fakeAzureAborter = 'fakeAborter'
//   const mockContainerCreateIfNotExists = jest.fn()

//   const mockBlockBlob = jest.fn()
//   const setMockBlobUrl = url => {
//     azure.BlockBlobClient.fromContainerURL = mockBlockBlob.mockReturnValue({ url })
//   }
//   const tvm = jest.fn()
//   /** @type {AzureBlobFiles} */
//   let files
//   azure.generateBlobSASQueryParameters = jest.fn()
//   azure.BlobSASPermissions.parse = jest.fn()

//   beforeEach(async () => {
//     tvm.mockReset()
//     azure.generateBlobSASQueryParameters.mockReset()
//     azure.BlobSASPermissions.parse.mockReset()

//     mockContainerCreateIfNotExists.mockReset()
//     mockBlockBlob.mockReset()
//     azure.ContainerClient = jest.fn()
//     azure.ContainerClient.fromServiceURL = jest.fn()
//     azure.ContainerClient.fromServiceURL.mockReturnValue({
//       create: mockContainerCreateIfNotExists,
//       url: fakeSASCredentials.sasURLPrivate
//     })
//     azure.Aborter = { none: fakeAzureAborter }

//     // defaults that work
//     azure.generateBlobSASQueryParameters.mockReturnValue({ toString: () => 'fakeSAS' })
//     azure.BlobSASPermissions.parse.mockReturnValue({ toString: () => 'fakePermissionStr' })

//     tvm.getAzureBlobPresignCredentials = jest.fn()
//     tvm.getAzureBlobPresignCredentials.mockResolvedValue({
//       signature: 'fakesign'
//     })

//     fetch.mockResolvedValue({
//       text: fakeResponse
//     })
//     fakeResponse.mockResolvedValue(fakeAccessPolicy)
//     files = await AzureBlobFiles.init(fakeSASCredentials, tvm)
//
//   })

//   test('_getPresignUrl with no options', async () => {
//     await expect(files._getPresignUrl('fakesub/afile')).rejects.toThrow('[FilesLib:ERROR_MISSING_OPTION] expiryInSeconds')
//   })
//   test('_getPresignUrl with missing options', async () => {
//     await expect(files._getPresignUrl('fakesub/afile', { test: 'fake' })).rejects.toThrow('[FilesLib:ERROR_MISSING_OPTION] expiryInSeconds')
//   })
//   test('_getPresignUrl with correct options default permission', async () => {
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = DEFAULT_CDN_STORAGE_HOST + '/fake/fakesub/afile?fakesign'
//     const url = await files._getPresignUrl('fakesub/afile', { expiryInSeconds: 60 })
//     expect(url).toEqual(expectedUrl)
//     expect(tvm.getAzureBlobPresignCredentials).toHaveBeenCalledWith({ blobName: 'fakesub/afile', expiryInSeconds: 60, permissions: 'r' })
//   })

//   test('_getPresignUrl with correct options explicit permissions', async () => {
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = DEFAULT_CDN_STORAGE_HOST + '/fake/fakesub/afile?fakesign'
//     const url = await files._getPresignUrl('fakesub/afile', { expiryInSeconds: 60, permissions: 'fake' })
//     expect(url).toEqual(expectedUrl)
//     expect(tvm.getAzureBlobPresignCredentials).toHaveBeenCalledWith({ blobName: 'fakesub/afile', expiryInSeconds: 60, permissions: 'fake' })
//   })

//   test('_getPresignUrl with correct options default permission own credentials', async () => {
//     files = await AzureBlobFiles.init(fakeUserCredentials)
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile?fakeSAS'
//     const url = await files._getPresignUrl('fakesub/afile', { expiryInSeconds: 60 })
//     expect(url).toEqual(expectedUrl)
//   })

//   test('_getPresignUrl with correct options explicit permission own credentials', async () => {
//     files = await AzureBlobFiles.init(fakeUserCredentials)
//     const cleanUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile'
//     setMockBlobUrl(cleanUrl)
//     const expectedUrl = 'https://fake.blob.core.windows.net/fake/fakesub/afile?fakeSAS'
//     const url = await files._getPresignUrl('fakesub/afile', { expiryInSeconds: 60, permissions: 'fake' })
//     expect(url).toEqual(expectedUrl)
//   })

//   test('_getPresignUrl with correct options explicit permission own sas credentials', async () => {
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//     await expect(files._getAzureBlobPresignCredentials('fakesub/afile', { expiryInSeconds: 60 })).rejects.toThrow('[FilesLib:ERROR_UNSUPPORTED_OPERATION] generatePresignURL is not supported with Azure Container SAS credentials, please initialize the SDK with Azure storage account credentials instead')
//   })
// })

// describe('_revokeAllPresignURLs', () => {
//   const fakeAzureAborter = 'fakeAborter'
//   const mockContainerCreateIfNotExists = jest.fn()
//   const mockSetAccessPolicy = jest.fn()

//   const mockBlockBlob = jest.fn()
//   const tvm = jest.fn()
//   /** @type {AzureBlobFiles} */
//   let files
//   azure.generateBlobSASQueryParameters = jest.fn()
//   azure.BlobSASPermissions.parse = jest.fn()

//   beforeEach(async () => {
//     tvm.mockReset()
//     azure.generateBlobSASQueryParameters.mockReset()
//     azure.BlobSASPermissions.parse.mockReset()

//     mockContainerCreateIfNotExists.mockReset()
//     mockSetAccessPolicy.mockReset()
//     mockBlockBlob.mockReset()
//     azure.ContainerClient = jest.fn()
//     azure.ContainerClient.fromServiceURL = jest.fn()
//     azure.ContainerClient.fromServiceURL.mockReturnValue({
//       create: mockContainerCreateIfNotExists,
//       setAccessPolicy: mockSetAccessPolicy,
//       url: fakeSASCredentials.sasURLPrivate
//     })
//     azure.Aborter = { none: fakeAzureAborter }

//     // defaults that work
//     azure.generateBlobSASQueryParameters.mockReturnValue({ toString: () => 'fakeSAS' })
//     azure.BlobSASPermissions.parse.mockReturnValue({ toString: () => 'fakePermissionStr' })

//     tvm.revokeAzureBlobPresignCredentials = jest.fn()
//     tvm.revokeAzureBlobPresignCredentials.mockResolvedValue({})

//     tvm.revokePresignURLs = jest.fn()
//     tvm.revokePresignURLs.mockResolvedValue({})

//     files = await AzureBlobFiles.init(fakeSASCredentials, tvm)
//

//     fetch.mockResolvedValue({
//       text: fakeResponse
//     })
//     fakeResponse.mockResolvedValue(fakeAccessPolicy)
//   })

//   test('_revokeAllPresignURLs via tvm', async () => {
//     await files._revokeAllPresignURLs()
//     expect(tvm.revokePresignURLs).toHaveBeenCalled()
//   })

//   test('_revokeAllPresignURLs with own credentials', async () => {
//     files = await AzureBlobFiles.init(fakeUserCredentials)
//     await files._revokeAllPresignURLs()
//     expect(mockSetAccessPolicy).toHaveBeenCalled()
//   })

//   test('_revokeAllPresignURLs with own sas credentials', async () => {
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//     await expect(files._revokeAllPresignURLs()).rejects.toThrow('[FilesLib:ERROR_UNSUPPORTED_OPERATION] revokeAllPresignURLs is not supported with Azure Container SAS credentials, please initialize the SDK with Azure storage account credentials instead')
//   })
// })

// describe('_statusFromProviderError', () => {
//   /** @type {AzureBlobFiles} */
//   let files

//   beforeEach(async () => {
//     files = await AzureBlobFiles.init(fakeSASCredentials)
//   })

//   test('error has no response field', async () => {
//     const status = await files._statusFromProviderError(new Error('yolo'))
//     expect(status).toEqual(undefined)
//   })

//   test('error has no response.status field', async () => {
//     const status = await files._statusFromProviderError({ response: 'yolo' })
//     expect(status).toEqual(undefined)
//   })

//   test('error has response.status field', async () => {
//     const status = await files._statusFromProviderError({ response: { status: 404 } })
//     expect(status).toEqual(404)
//   })
// })
