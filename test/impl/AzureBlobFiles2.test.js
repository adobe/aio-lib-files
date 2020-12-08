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
const fakeResponse = jest.fn()

const { AzureBlobFiles } = require('../../lib/impl/AzureBlobFiles')
const stream = require('stream')
const cloneDeep = require('lodash.clonedeep')

const AzureLib = require('@azure/storage-blob')
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

const DEFAULT_CDN_STORAGE_HOST = 'https://firefly.azureedge.net'

beforeEach(async () => {
  expect.hasAssertions()
  jest.resetAllMocks()
  AzureLib.StorageSharedKeyCredential = jest.fn()
  AzureBlobFiles
})

describe('init', () => {
  test('when called with no credentials', async () => {
    await expect(AzureBlobFiles.init()).rejects.toThrow('ERROR_BAD_ARGUMENT')
  })

  // test('when called with too many credentials', async () => {
  //   await expect(AzureBlobFiles.init(fakeSASCredentials, fakeUserCredentials)).rejects.toThrow('ERROR_BAD_ARGUMENT')
  // })

  test('when called with SAS credentials', async () => {
    const fileLib = await AzureBlobFiles.init(fakeSASCredentials)
    expect(fileLib._azure).toBeDefined()
    expect(fileLib.hasOwnCredentials).toBe(true)
  })

  test('when called with User credentials', async () => {
    const fileLib = await AzureBlobFiles.init(fakeUserCredentials)
    expect(fileLib._azure).toBeDefined()
    expect(fileLib.hasOwnCredentials).toBe(false)
  })
})
