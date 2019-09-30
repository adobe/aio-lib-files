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

const { AzureBlobFiles } = require('../../lib/impl/AzureBlobFiles')
const stream = require('stream')
const cloneDeep = require('lodash.clonedeep')

const azure = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const fakeSASCredentials = {
  sasURLPrivate: 'https://fake.com/private?secret=abcd',
  sasURLPublic: 'https://fake.com/public?secret=abcd'
}
const fakeAborter = 'fakeAborter'

beforeEach(async () => {
  expect.hasAssertions()
  jest.resetAllMocks()
})

const testWithProviderError = async (boundFunc, providerMock, errorDetails, file404) => {
  errorDetails = cloneDeep(errorDetails)
  if (file404) {
    providerMock.mockRejectedValue({ response: { status: 404 } })
    await global.expectToThrowFileNotExists(boundFunc, file404, errorDetails)
  }
  // 403
  providerMock.mockRejectedValue({ response: { status: 403 } })
  await global.expectToThrowBadCredentials(boundFunc, errorDetails)
  // unknown status 444
  let error = { response: { status: 444 }, somefield: true }
  providerMock.mockRejectedValue(error)
  await global.expectToThrowInternalWithStatus(boundFunc, 444, { ...errorDetails, _internal: error })
  // no status
  error = { response: 'error', somefield: true }
  providerMock.mockRejectedValue(error)
  await global.expectToThrowInternal(boundFunc, { ...errorDetails, _internal: error })
}

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

  const checkInitDebugLogNoSecrets = (str) => expect(global.mockLogDebug).not.toHaveBeenCalledWith(expect.stringContaining(str))

  describe('with bad args', () => {
    test('when called with no arguments', async () => {
      await global.expectToThrowBadArg(AzureBlobFiles.init, ['credentials', 'required'], {})
    })
    test('when called with incomplete SAS credentials', async () => {
      const badInput = { ...fakeSASCredentials }
      delete badInput.sasURLPrivate
      const details = { sasURLPublic: fakeSASCredentials.sasURLPublic.split('?')[0] + '?<hidden>' } // hide token part of SAS in error details
      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, badInput), ['credentials', 'required', 'sasURLPrivate'], details)
    })
    test('when called with incomplete user credentials', async () => {
      const badInput = { ...fakeUserCredentials }
      delete badInput.containerName
      const details = { storageAccount: fakeUserCredentials.storageAccount, storageAccessKey: '<hidden>' }
      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, badInput), ['credentials', 'required', 'containerName'], details)
    })
    test('when called with both sas and user credentials', async () => {
      const fakeErrorDetails = cloneDeep({ ...fakeUserCredentials, ...fakeSASCredentials })
      fakeErrorDetails.sasURLPublic = fakeErrorDetails.sasURLPublic.split('?')[0] + '?<hidden>'
      fakeErrorDetails.sasURLPrivate = fakeErrorDetails.sasURLPrivate.split('?')[0] + '?<hidden>'
      fakeErrorDetails.storageAccessKey = '<hidden>'

      await global.expectToThrowBadArg(AzureBlobFiles.init.bind(null, { ...fakeUserCredentials, ...fakeSASCredentials }), ['credentials', 'conflict'], fakeErrorDetails)
    })
  })

  describe('with azure storage account credentials', () => {
    test('when public/private blob containers do not exist', async () => {
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockContainerCreate).toHaveBeenCalledTimes(2)
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
      checkInitDebugLogNoSecrets(fakeUserCredentials.storageAccessKey)
    })
    test('when blob containers already exist', async () => {
      // here we make sure that no error is thrown (ignore if already exist)
      mockContainerCreate.mockRejectedValue({ body: { Code: 'ContainerAlreadyExists' } })
      const files = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files).toBeInstanceOf(AzureBlobFiles)
      expect(mockContainerCreate).toHaveBeenCalledTimes(2)
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })

      mockContainerCreate.mockReset()

      mockContainerCreate.mockRejectedValue({ body: { code: 'ContainerAlreadyExists' } })
      const files2 = await AzureBlobFiles.init(fakeUserCredentials)
      expect(files2).toBeInstanceOf(AzureBlobFiles)
      expect(mockContainerCreate).toHaveBeenCalledTimes(2)
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, {})
      expect(mockContainerCreate).toHaveBeenCalledWith(fakeAzureAborter, { access: 'blob' })
      checkInitDebugLogNoSecrets(fakeUserCredentials.storageAccessKey)
    })
    test('when there is a provider error on blob container creation',
      async () => testWithProviderError(AzureBlobFiles.init.bind(null, fakeUserCredentials), mockContainerCreate, { containerName: fakeUserCredentials.containerName, storageAccount: fakeUserCredentials.storageAccount }))
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
    const files = await AzureBlobFiles.init(fakeSASCredentials)
    expect(azure.ContainerURL).toHaveBeenNthCalledWith(1, fakeSASCredentials.sasURLPrivate, fakeAzurePipeline)
    expect(azure.ContainerURL).toHaveBeenNthCalledWith(2, fakeSASCredentials.sasURLPublic, fakeAzurePipeline)
    expect(files).toBeInstanceOf(AzureBlobFiles)
    checkInitDebugLogNoSecrets(fakeSASCredentials.sasURLPublic)
    checkInitDebugLogNoSecrets(fakeSASCredentials.sasURLPrivate)
  })
})
describe('_fileExists', () => {
  const mockBlobGetProperties = jest.fn()

  const fileInPrivateDir = 'dir/inadir/file.html'
  const fileInRoot = 'afile.html'
  const fileInPublicDir = 'public/afile.html'
  const fileInPublicSubDir = 'public/sub/afile.html'
  const fileWithoutExtension = 'afile'
  const fakeAzureFileProps = { fake: 'props' }

  let files
  beforeEach(async () => {
    mockBlobGetProperties.mockReset()
    azure.ContainerURL = jest.fn()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ getProperties: mockBlobGetProperties })
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })

  const expectExists = async (exists) => {
    exists ? mockBlobGetProperties.mockResolvedValue(fakeAzureFileProps) : mockBlobGetProperties.mockRejectedValue({ response: { status: 404 } })
    expect(await files._fileExists(fileInPrivateDir)).toEqual(exists)
    expect(await files._fileExists(fileInRoot)).toEqual(exists)
    expect(await files._fileExists(fileInPublicDir)).toEqual(exists)
    expect(await files._fileExists(fileInPublicSubDir)).toEqual(exists)
    expect(await files._fileExists(fileWithoutExtension)).toEqual(exists)
    expect(mockBlobGetProperties).toHaveBeenCalled()
  }
  test('when it exists', async () => expectExists(true))
  test('when it does not exists', async () => expectExists(false))

  test('when there is a provider error on azure.BlockBlobURL.getProperties',
    async () => testWithProviderError(files._fileExists.bind(files, fileInPrivateDir), mockBlobGetProperties, { filePath: fileInPrivateDir }))
})

describe('_listFolder', () => {
  const privateDir = 'some/private/dir/'
  const publicDir = 'public/some/dir/'
  const fakeAzureListResponse = (files, marker) => { return { marker: marker, segment: { blobItems: files.map(name => { return { name } }) } } }
  const mockContainerPublicList = jest.fn()
  const mockContainerPrivateList = jest.fn()
  const fakeListArguments = (prefix, marker) => {
    const options = { delimiter: '/' }
    if (prefix !== '') options.prefix = prefix
    return [fakeAborter, marker, options]
  }

  const fakeFiles = ['file1', 'subdir/file2', 'another/subdir/file3']
  const fakeFiles2 = ['file4', 'subdir2/file5', 'another2/subdir3/file6']
  const multiFakeFiles = [['file1', 'subdir/file2', 'another/subdir/file3'], ['file4', 'subdir/file5', 'another/subdir/file6'], ['file7']]

  let files
  beforeEach(async () => {
    mockContainerPublicList.mockReset()
    mockContainerPrivateList.mockReset()
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.containerURLPrivate = { listBlobFlatSegment: mockContainerPrivateList }
    files._azure.containerURLPublic = { listBlobFlatSegment: mockContainerPublicList }
    files._azure.aborter = fakeAborter
  })

  // eslint-disable-next-line jsdoc/require-jsdoc
  function testListFolder (filePath, listsPublic, listsPrivate, isRoot) {
    return async () => {
      const publicFiles = fakeFiles.map(f => publicDir + f)
      const privateFiles = fakeFiles2.map(f => privateDir + f)
      mockContainerPublicList.mockResolvedValue(fakeAzureListResponse(publicFiles))
      mockContainerPrivateList.mockResolvedValue(fakeAzureListResponse(privateFiles))
      expect((await files._listFolder(filePath)).sort()).toEqual(((listsPublic ? publicFiles : []).concat((listsPrivate ? privateFiles : []))).sort())
      expect(mockContainerPublicList).toHaveBeenCalledTimes(listsPublic ? 1 : 0)
      if (listsPublic) expect(mockContainerPublicList).toHaveBeenCalledWith(...fakeListArguments(isRoot ? 'public' : filePath))
      expect(mockContainerPrivateList).toHaveBeenCalledTimes(listsPrivate ? 1 : 0)
      if (listsPrivate) expect(mockContainerPrivateList).toHaveBeenCalledWith(...fakeListArguments(isRoot ? '' : filePath))
    }
  }

  // test('when it is the root (`/`)', testListFolder('/', true, true, true)) // => this test is not valid as we assume
  // that only normalized path should be passed azure blob files functions
  test('when it is the root (empty string)', testListFolder('', true, true, true))

  test('when it is a private', testListFolder(privateDir, false, true))
  test('when it is a public', testListFolder(publicDir, true, false))
  test('when multiple calls are needed to list all files', async () => {
    const publicFiles = multiFakeFiles.map(arr => arr.map(f => publicDir + f))
    let count = 0
    mockContainerPublicList.mockImplementation(async () => { return fakeAzureListResponse(publicFiles[count++], count < publicFiles.length) })
    expect(await files._listFolder(publicDir)).toEqual(publicFiles.reduce((prev, curr) => prev.concat(curr), []))
    expect(mockContainerPublicList).toHaveBeenCalledTimes(3)
    expect(mockContainerPrivateList).toHaveBeenCalledTimes(0)
    expect(mockContainerPublicList).toHaveBeenCalledWith(...fakeListArguments(publicDir))
  })
  test('when azure.ContainerURL.list rejects with an error', async () =>
    testWithProviderError(files._listFolder.bind(files, publicDir), mockContainerPublicList, { filePath: publicDir }))
})

describe('_deleteFile', () => {
  const mockAzureDelete = jest.fn()
  let files
  beforeEach(async () => {
    mockAzureDelete.mockReset()

    azure.ContainerURL = jest.fn()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ delete: mockAzureDelete })
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })

  test('a file that exists', async () => {
    mockAzureDelete.mockResolvedValue(true)
    await files._deleteFile('afile')
    expect(mockAzureDelete).toHaveBeenCalledTimes(1)
  })
  // also checks 404 (note the double 'afile')
  test('when azure.BlockBlobURL.delete rejects with an error, including file not exists (404)', async () =>
    testWithProviderError(files._deleteFile.bind(files, 'afile'), mockAzureDelete, { filePath: 'afile' }, 'afile'))
})

describe('_createReadStream', () => {
  const fakeFile = 'a/dir/file1'
  const mockAzureDownload = jest.fn()
  let files
  beforeEach(async () => {
    mockAzureDownload.mockReset()
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ download: mockAzureDownload })
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })
  let fakeRdStream
  const fakeOptions = { position: 1, length: 10 }
  beforeEach(() => {
    fakeRdStream = new stream.Readable()
    fakeRdStream.push(null)
    mockAzureDownload.mockResolvedValue({ readableStreamBody: fakeRdStream })
  })
  test('w default options ({ position: 0, length: undefined })', async () => {
    const res = await files._createReadStream(fakeFile, { position: 0 })
    expect(res).toBe(fakeRdStream)
    expect(mockAzureDownload).toHaveBeenCalledTimes(1)
    expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, 0, undefined)
  })
  test('with options', async () => {
    const res = await files._createReadStream(fakeFile, fakeOptions)
    expect(res).toBe(fakeRdStream)
    expect(mockAzureDownload).toHaveBeenCalledTimes(1)
    expect(mockAzureDownload).toHaveBeenCalledWith(fakeAborter, fakeOptions.position, fakeOptions.length)
  })
  test('when azure.BlockBlobURL.download rejects with an error, including file not exists (404)', async () =>
    testWithProviderError(files._createReadStream.bind(files, 'afile', {}), mockAzureDownload, { filePath: 'afile', options: {} }, 'afile'))
})

describe('_writeBuffer', () => {
  const fakeFile = 'a/dir/file1'
  const mockAzureUpload = jest.fn()
  const fakeBuffer = Buffer.from('some fake content @#$%^&*()@!12-=][;"\n\trewq')
  let files
  beforeEach(async () => {
    mockAzureUpload.mockReset()
    mockAzureUpload.mockResolvedValue(true)
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ upload: mockAzureUpload })
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })

  const testWriteBuffer = (fileExt, expectMimeType) => async () => {
    const res = await files._writeBuffer(fakeFile + fileExt, fakeBuffer)
    expect(res).toBe(fakeBuffer.length)
    expect(mockAzureUpload).toHaveBeenCalledTimes(1)
    expect(mockAzureUpload).toHaveBeenCalledWith(fakeAborter, fakeBuffer, fakeBuffer.length, { blobHTTPHeaders: { blobContentType: expectMimeType } })
  }
  test('when file has valid mime type file extension', testWriteBuffer('.json', 'application/json'))
  test('when file has invalid mime type file extension', testWriteBuffer('.iiiiiiiii', 'application/octet-stream'))
  test('when file has no file extension', testWriteBuffer('', 'application/octet-stream'))

  test('when azure.BlockBlobURL throws an error', async () =>
    testWithProviderError(files._writeBuffer.bind(files, 'afile', fakeBuffer), mockAzureUpload, { filePath: 'afile', contentType: 'Buffer' }))
})

describe('_writeStream', () => {
  const fakeFile = 'a/dir/file1'
  const mockAzureStreamUpload = jest.fn()
  const fakeContent = 'some fake content @#$%^&*()@!12-=][;"\n\trewq'
  let fakeRdStream
  let files
  beforeEach(async () => {
    mockAzureStreamUpload.mockReset()
    mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
    azure.uploadStreamToBlockBlob = mockAzureStreamUpload
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
    fakeRdStream = new stream.Readable()
    fakeRdStream.push(fakeContent)
    fakeRdStream.push(null)
  })

  const testWriteStream = (fileExt, expectMimeType) => async () => {
    const res = await files._writeStream(fakeFile + fileExt, fakeRdStream)
    expect(res).toBe(fakeContent.length)
    expect(mockAzureStreamUpload).toHaveBeenCalledTimes(1)
    expect(mockAzureStreamUpload.mock.calls[0]).toEqual(expect.arrayContaining([fakeRdStream, { blobHTTPHeaders: { blobContentType: expectMimeType } }]))
  }
  test('when file has valid mime type file extension', testWriteStream('.json', 'application/json'))
  test('when file has invalid mime type file extension', testWriteStream('.iiiiiiiii', 'application/octet-stream'))
  test('when file has no file extension', testWriteStream('', 'application/octet-stream'))

  test('when azure.uploadStreamToBlockBlob throws an error', async () =>
    testWithProviderError(files._writeStream.bind(files, 'afile', fakeRdStream), mockAzureStreamUpload, { filePath: 'afile', contentType: 'Readable' }))
})
describe('_createWriteStream', () => {
  const mockAzureStreamUpload = jest.fn()

  const fakeFile = 'a/dir/file1'
  const fakeChunks = ['some ', 'fake con', 'tent @#$%^&*()@!', '12-=][;"\n\trewq']
  const fakeChunksSize = fakeChunks.reduce((prev, curr) => prev + curr.length, 0)

  /** @type {AzureBlobFiles} */
  let files
  beforeEach(async () => {
    mockAzureStreamUpload.mockReset()
    mockAzureStreamUpload.mockImplementation((_, stream) => new Promise((resolve) => stream.on('end', resolve))) // tight coupling..
    azure.uploadStreamToBlockBlob = mockAzureStreamUpload
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })

  test('with file with html extension, write multiple chunks and end the stream', async done => {
    expect.assertions(5)
    const wrStream = await files._createWriteStream(fakeFile + '.html')
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
  test('when stream is written and azure.uploadStreamToBlockBlob rejects an error', async done => {
    mockAzureStreamUpload.mockRejectedValue({ response: { status: 444 } })
    const wrStream = await files._createWriteStream(fakeFile)
    wrStream.write('hi')
    wrStream.on('error', async e => {
      await global.expectToThrowInternalWithStatus(() => { throw e }, 444, { filePath: fakeFile, _internal: { response: { status: 444 } } })
      done()
    })
  })
  test('when stream is written and azure.uploadStreamToBlockBlob rejects with 403', async done => {
    mockAzureStreamUpload.mockRejectedValue({ response: { status: 403 } })
    const wrStream = await files._createWriteStream(fakeFile)
    wrStream.write('hi')
    wrStream.on('error', async e => {
      await global.expectToThrowBadCredentials(() => { throw e }, { filePath: fakeFile })
      done()
    })
  })
})

describe('_copyRemoteToRemoteFile', () => {
  const mockStartCopyFromURL = jest.fn()
  const mockGetUrl = jest.fn()

  const src = 'a/dir/file1'
  const dest = 'public/another/dir/file2'
  const fakeSrcURL = 'https://fakefiles.com/a/dir/file1'
  mockGetUrl.mockReturnValue(fakeSrcURL)
  /** @type {AzureBlobFiles} */
  let files
  beforeEach(async () => {
    mockGetUrl.mockReset()
    mockStartCopyFromURL.mockReset()
    mockGetUrl.mockReturnValue(fakeSrcURL)
    mockStartCopyFromURL.mockResolvedValue(true)
    azure.BlockBlobURL.fromContainerURL = jest.fn().mockReturnValue({ startCopyFromURL: mockStartCopyFromURL })
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
    files._getUrl = mockGetUrl
  })

  test('when source file exists', async () => {
    await files._copyRemoteToRemoteFile(src, dest)
    expect(mockStartCopyFromURL).toHaveBeenCalledTimes(1)
    expect(mockStartCopyFromURL.mock.calls[0]).toEqual(expect.arrayContaining([fakeSrcURL]))
  })

  test('when azure.uploadStreamToBlockBlob throws an error', async () =>
    testWithProviderError(files._copyRemoteToRemoteFile.bind(files, src, dest), mockStartCopyFromURL, { srcPath: src, destPath: dest }, src))
})

describe('_getUrl', () => {
  const mockBlockBlob = jest.fn()
  const setMockBlobUrl = url => {
    azure.BlockBlobURL.fromContainerURL = mockBlockBlob.mockReturnValue({ url })
  }
  /** @type {AzureBlobFiles} */
  let files
  beforeEach(async () => {
    mockBlockBlob.mockReset()
    azure.ContainerURL = jest.fn()
    files = await AzureBlobFiles.init(fakeSASCredentials)
    files._azure.aborter = fakeAborter
  })

  test('url with no query args', async () => {
    const cleanUrl = 'https://fakeFiles.com/fake/fakesub/afile'
    setMockBlobUrl(cleanUrl)
    const url = files._getUrl('fakesub/afile')
    expect(url).toEqual(cleanUrl)
  })

  test('url with query args', async () => {
    const cleanUrl = 'https://fakeFiles.com/fake/fakesub/afile'
    setMockBlobUrl(cleanUrl + '?password=xxxx&user=username')
    const url = files._getUrl('fakesub/afile')
    expect(url).toEqual(cleanUrl)
  })
})

describe('_statusFromProviderError', () => {
  /** @type {AzureBlobFiles} */
  let files
  beforeEach(async () => {
    files = await AzureBlobFiles.init(fakeSASCredentials)
  })
  test('error has no response field', async () => {
    const status = await files._statusFromProviderError(new Error('yolo'))
    expect(status).toEqual(undefined)
  })
  test('error has no response.status field', async () => {
    const status = await files._statusFromProviderError({ response: 'yolo' })
    expect(status).toEqual(undefined)
  })
  test('error has response.status field', async () => {
    const status = await files._statusFromProviderError({ response: { status: 404 } })
    expect(status).toEqual(404)
  })
})
