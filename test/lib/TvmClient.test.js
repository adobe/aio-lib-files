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

const { TvmClient } = require('../../lib/TvmClient')

const fs = require('fs-extra')
jest.mock('fs-extra')

const request = require('request-promise')
jest.mock('request-promise')

const maxDate = new Date(8640000000000000).toISOString()
const minDate = new Date(-8640000000000000).toISOString()

let fakeAzureTVMResponse
let fakeTVMInput
let cacheKey
let cacheContent
beforeEach(async () => {
  await jest.restoreAllMocks()
  fakeTVMInput = {
    ow: {
      namespace: 'fake',
      auth: 'fake'
    },
    apiUrl: 'https://fake.com'
  }
  fakeAzureTVMResponse = {
    expiration: maxDate,
    sasURLPrivate: 'https://fake.com',
    sasURLPublic: 'https://fake.com'
  }
  cacheKey = fakeTVMInput.ow.namespace + '-' + fakeTVMInput.apiUrl + '/' + TvmClient.AzureBlobEndpoint
  cacheContent = JSON.stringify({ [cacheKey]: fakeAzureTVMResponse })
})

describe('constructor', () => {
  describe('with bad arguments', () => {
    test('no args', async () => {
      const instantiate = () => new TvmClient()
      await expect(instantiate).toThrowBadArgWithMessageContaining(['config', 'required'], false)
    })
    test('missing ow object', async () => {
      const badInput = { ...fakeTVMInput }
      badInput.ow = undefined
      const instantiate = () => new TvmClient(badInput)
      await expect(instantiate).toThrowBadArgWithMessageContaining(['ow', 'required'], false)
    })
    test('missing apiUrl', async () => {
      const badInput = { ...fakeTVMInput }
      badInput.apiUrl = undefined
      const instantiate = () => new TvmClient(badInput)
      await expect(instantiate).toThrowBadArgWithMessageContaining(['apiUrl', 'required'], false)
    })
  })
})

describe('getAzureBlobCredentials', () => {
  describe('without caching', () => {
    test('when tvm response is valid', async () => {
      // fake the request to the TVM
      request.post.mockReturnValue(fakeAzureTVMResponse)
      fakeTVMInput.cacheFile = false
      const tvmClient = new TvmClient(fakeTVMInput)
      const creds = await tvmClient.getAzureBlobCredentials()
      expect(creds).toEqual(fakeAzureTVMResponse)
    })
  })
  describe('with caching to file', () => {
    test('when cache exists', async () => {
      request.mockReturnValue('bad response')
      fs.readFile.mockReturnValue(Promise.resolve(Buffer.from(cacheContent)))

      fakeTVMInput.cacheFile = '/cache'
      const tvmClient = new TvmClient(fakeTVMInput)
      const creds = await tvmClient.getAzureBlobCredentials()

      expect(creds).toEqual(fakeAzureTVMResponse)
      expect(fs.readFile).toHaveBeenCalledWith(fakeTVMInput.cacheFile)
    })

    test('when cache is empty', async () => {
      request.mockReturnValue(fakeAzureTVMResponse)
      fs.readFile.mockReturnValue(Promise.reject(new Error('whatever')))

      fakeTVMInput.cacheFile = '/cache'
      const tvmClient = new TvmClient(fakeTVMInput)
      const creds = await tvmClient.getAzureBlobCredentials()

      expect(creds).toEqual(fakeAzureTVMResponse)
      expect(fs.writeFile).toHaveBeenCalledWith(fakeTVMInput.cacheFile, cacheContent)
    })

    test('when cache for other key exists', async () => {
      const prevObject = { prevKey: { fake: 'creds' } }
      request.mockReturnValue(fakeAzureTVMResponse)
      fs.readFile.mockReturnValue(Promise.resolve(Buffer.from(JSON.stringify(prevObject))))

      const tvmClient = new TvmClient(fakeTVMInput)
      const creds = await tvmClient.getAzureBlobCredentials()

      expect(creds).toEqual(fakeAzureTVMResponse)
      expect(fs.writeFile).toHaveBeenCalledWith(TvmClient.DefaultTVMCacheFile, JSON.stringify({ ...prevObject, [cacheKey]: fakeAzureTVMResponse }))
    })

    test('when cache for same key exists but is expired', async () => {
      const prevObject = { [cacheKey]: { fake: 'creds', expiration: minDate } }
      request.mockReturnValue(fakeAzureTVMResponse)
      fs.readFile.mockReturnValue(Promise.resolve(Buffer.from(JSON.stringify(prevObject))))

      const tvmClient = new TvmClient(fakeTVMInput)
      const creds = await tvmClient.getAzureBlobCredentials()

      expect(creds).toEqual(fakeAzureTVMResponse)
      expect(fs.writeFile).toHaveBeenCalledWith(TvmClient.DefaultTVMCacheFile, JSON.stringify({ [cacheKey]: fakeAzureTVMResponse }))
    })
  })
})
