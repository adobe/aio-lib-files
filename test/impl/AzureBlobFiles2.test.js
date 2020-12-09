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
const fetch = require('node-fetch')
jest.mock('node-fetch', () => jest.fn())

// const fakeResponse = jest.fn()
// const fs = require('fs')

const { AzureBlobFiles } = require('../../lib/impl/AzureBlobFiles')
const { Files, FilePermissions } = require('../../lib/Files')

// const stream = require('stream')
// const cloneDeep = require('lodash.clonedeep')

const AzureLib = require('@azure/storage-blob')
jest.mock('@azure/storage-blob')

const { codes, logAndThrow } = require('../../lib/FilesError')
jest.mock('../../lib/FilesError')

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

const DEFAULT_CDN_STORAGE_HOST = 'https://firefly.azureedge.net'

describe('create', () => {

  beforeEach(async () => {
    jest.resetAllMocks()
    Files.prototype._wrapProviderRequest = jest.fn()

    AzureLib.StorageSharedKeyCredential = jest.fn()
    // ContainerClient
    AzureLib.BlobServiceClient = jest.fn(() => {
      return {
        getContainerClient: jest.fn(() => {
          return {
            createIfNotExists: jest.fn(),
            url: 'somestring'
          }
        })
      }
    })
    AzureLib.ContainerClient.mockImplementation(async () => {
      return {
        createIfNotExists: jest.fn(),
        url: 'somestring'
      }
    })

    fetch.mockImplementation(() => {
      return {
        text: jest.fn(() => {
          return fakeAccessPolicy
        })
      }
    })

    // AzureBlobFiles
    codes.ERROR_BAD_ARGUMENT.mockImplementation((msg) => {
      return { message: msg.messageValues[0] }
    })
  })

  describe('constructor', () => {
    test('logAndThrows when called without credentials (null)', async () => {
      expect(new AzureBlobFiles()).toStrictEqual(expect.objectContaining({ _azure: {} }))
      expect(codes.ERROR_BAD_ARGUMENT).toHaveBeenCalled()
      expect(logAndThrow).toHaveBeenCalledWith({ message: expect.stringContaining('credentials') })
    })

    test('logAndThrows when called without credentials ({})', async () => {
      expect(new AzureBlobFiles({})).toStrictEqual(expect.objectContaining({ _azure: {} }))
      expect(codes.ERROR_BAD_ARGUMENT).toHaveBeenCalled()
      expect(logAndThrow).toHaveBeenCalledWith({ message: expect.stringContaining('credentials') })
    })

    test('succeeds when called with credentials (fakeSASCredentials)', async () => {
      expect(new AzureBlobFiles(fakeSASCredentials)).toStrictEqual(expect.objectContaining({ credentials: fakeSASCredentials }))
      expect(codes.ERROR_BAD_ARGUMENT).not.toHaveBeenCalled()
      expect(logAndThrow).not.toHaveBeenCalled()
    })

    test('succeeds when called with credentials (fakeUserCredentials)', async () => {
      expect(new AzureBlobFiles(fakeUserCredentials)).toStrictEqual(expect.objectContaining({ credentials: fakeUserCredentials }))
      expect(codes.ERROR_BAD_ARGUMENT).not.toHaveBeenCalled()
      expect(logAndThrow).not.toHaveBeenCalled()
    })

    test('logAndThrows when called with mixed credentials (fakeUserCredentials + fakeSASCredentials)', async () => {
      const mixedCredentials = {
        storageAccount: fakeUserCredentials.storageAccount,
        ...fakeSASCredentials
      }
      expect(new AzureBlobFiles(mixedCredentials)).toStrictEqual(expect.objectContaining({ credentials: mixedCredentials }))
      expect(codes.ERROR_BAD_ARGUMENT).toHaveBeenCalled()
      expect(logAndThrow).toHaveBeenCalled()
    })

    test('is subclass', async () => {
      const instance = new AzureBlobFiles(fakeSASCredentials)
      expect(instance instanceof AzureBlobFiles).toBeTruthy()
      expect(instance instanceof Files).toBeTruthy()
    })
  })

  describe('init', () => {
    test('when called with no credentials', async () => {
      logAndThrow.mockImplementation(() => {
        throw new Error('uh-oh')
      })
      await expect(AzureBlobFiles.init()).rejects.toThrow('uh-oh')
      expect(logAndThrow).toHaveBeenCalledWith({ message: expect.stringContaining('credentials') })
    })

    test('when called with SAS credentials', async () => {
      const fileLib = await AzureBlobFiles.init(fakeSASCredentials)
      expect(fileLib._azure).toBeDefined()
      expect(fileLib.hasOwnCredentials).toBe(true)
    })

    test('when called with User credentials', async () => {
      const fileLib = await AzureBlobFiles.init(fakeUserCredentials)
      expect(fileLib._azure).toBeDefined()
      expect(fileLib.hasOwnCredentials).toBe(true)
    })
  })
})

describe('interface', () => {
  let azFilesInstance = null
  beforeEach(async () => {
    azFilesInstance = await AzureBlobFiles.init(fakeSASCredentials)
    // console.log('azFilesInstance = ', azFilesInstance)
  })

  describe('public methods', () => {
    test('interface exists', async () => {
      expect(azFilesInstance).toBeDefined()
      expect(azFilesInstance.read).toBeDefined()
      expect(azFilesInstance.write).toBeDefined()
      expect(azFilesInstance.list).toBeDefined()
      expect(azFilesInstance.getProperties).toBeDefined()
      expect(azFilesInstance.delete).toBeDefined()
      expect(azFilesInstance.copy).toBeDefined()
      expect(azFilesInstance.generatePresignURL).toBeDefined()
      expect(azFilesInstance.revokeAllPresignURLs).toBeDefined()
    })
  })

  describe('files.read', () => {
    test('non existent file', async () => {
      // todo
      // public, private, stream
      const file = await azFilesInstance.read('dne')
      expect(file).toBeUndefined()
    })

    test('private file exists', async () => {
      // todo
      // public, private, stream
      const file = await azFilesInstance.read('exists.txt')
      expect(file).toBeUndefined()
    })

    test('public file exists', async () => {
      // todo
      // public, private, stream
      const file = await azFilesInstance.read('public/exists.txt')
      expect(file).toBeUndefined()
    })
  })

  describe('files.write', () => {
    test('string to public file', async () => {
      // todo
      // public, private, stream
      const count = await azFilesInstance.write('public/exists.txt', 'I exist')
      expect(count).toBeUndefined()
    })

    test('string to private file', async () => {
      const count = await azFilesInstance.write('exists.txt', 'I exist')
      expect(count).toBeUndefined()
    })

    test('stream to private file', async () => {
      const rdStream = fakeFs.createReadStream('my-local-file.txt')
      const count = await azFilesInstance.write('exists.txt', rdStream)
      expect(count).toBeUndefined()
    })

    test('stream to public file', async () => {
      const rdStream = fakeFs.createReadStream('my-local-file.txt')
      const count = await azFilesInstance.write('exists.txt', rdStream)
      expect(count).toBeUndefined()
    })
  })

  describe('files.list', () => {
    test('list public', async () => {
      const files = await azFilesInstance.list('public/')
      expect(files.length).toBe(10)
    })

    test('list private and public', async () => {
      const files = await azFilesInstance.list('/')
      expect(files.length).toBe(10)
    })

  })

  describe('files.getProperties', () => {
    test('non-existent public', async () => {
      const info = await azFilesInstance.getProperties('public/dne')
      expect(info).toBeUndefined()
    })

    test('non-existent private', async () => {
      const info = await azFilesInstance.getProperties('dne')
      expect(info).toBeUndefined()
    })

    test('exists public', async () => {
      const info = await azFilesInstance.getProperties('public/exists.txt')
      expect(info).toBeUndefined()
    })

    test('exists private', async () => {
      const info = await azFilesInstance.getProperties('dne')
      expect(info).toBeUndefined()
    })
  })

  describe('files.delete', () => {
    test('private does not exist', async () => {
      const info = await azFilesInstance.delete('dne')
      expect(info).toBeUndefined()
    })

    test('public does not exist', async () => {
      const info = await azFilesInstance.delete('public/dne')
      expect(info).toBeUndefined()
    })

    test('private exists', async () => {
      const info = await azFilesInstance.delete('exists.txt')
      expect(info).toBeUndefined()
    })

    test('public exists', async () => {
      const info = await azFilesInstance.delete('public/exists.txt')
      expect(info).toBeUndefined()
    })
  })

  describe('files.copy', () => {
    test('remote : private to public', async () => {
      const res = await azFilesInstance.copy('exists.txt', 'public/exists.txt')
      expect(res).toBeUndefined()
    })

    test('remote : public to private', async () => {
      const res = await azFilesInstance.copy('public/exists.txt', 'exists.txt')
      expect(res).toBeUndefined()
    })
  })

  // describe('files.generatePresignURL', () => {
  //   test('', async () => {
  //     // todo
  //   })
  // })

  // describe('files.revokeAllPresignURLs', () => {
  //   test('', async () => {
  //     // todo
  //   })
  // })
})
