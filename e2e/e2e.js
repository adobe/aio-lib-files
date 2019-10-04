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

/* ************* NOTE 1: these tests must be run sequentially, jest does it by default within a SINGLE file ************* */
/* ************* NOTE 2: requires env vars TEST_AUTH_1, TEST_NS_1 and TEST_AUTH_2, TEST_NS_2 for 2 different namespaces. ************* */
const fs = require('fs-extra')
const upath = require('upath')

const TEST_DIR = '.e2e' // do not end with '/'
const fullPath = p => upath.toUnix(upath.join(TEST_DIR, p))

const filesLib = require('../index')
const fetch = require('node-fetch').default

const testFile = 'e2e_test_file'
const testContent = 'hello world'

jest.setTimeout(60000) // one minute per test

beforeEach(() => {
  expect.hasAssertions()
})

const initFilesEnv = async (n = 1) => {
  delete process.env.__OW_AUTH
  delete process.env.__OW_NAMESPACE
  process.env.__OW_AUTH = process.env[`TEST_AUTH_${n}`]
  process.env.__OW_NAMESPACE = process.env[`TEST_NAMESPACE_${n}`]
  // 1. init will fetch credentials from the tvm using ow creds
  const files = await filesLib.init() // { tvm: { cacheFile: false } } // keep cache for better perf?
  // make sure we delete all files, this might fail as it is an operation under test
  await files.delete('/')
  return files
}

const readStream = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', data => {
      chunks.push(data)
    })
    stream.on('end', () => {
      resolve(Buffer.concat(chunks))
    })
    stream.on('error', reject)
  })
}

const expectToThrowCode = async (promise, code) => {
  let err
  try {
    await promise
  } catch (e) {
    expect({ name: e.name, code: e.code, message: e.message, sdkDetails: e.sdkDetails }).toEqual(expect.objectContaining({
      name: 'FilesLibError',
      code
    }))
    err = e
  }
  expect(err).toBeInstanceOf(Error)
}

const testACL = async (isPublic = false) => {
  const files = await initFilesEnv()

  const testFile = isPublic ? 'public/e2e/test/file' : 'e2e/test/file'

  await files.write(testFile, testContent)
  const props = await files.getProperties(testFile)
  expect(props).toEqual(expect.objectContaining({
    isPublic: isPublic,
    isDirectory: false,
    url: expect.any(String)
  }))
  const response = await fetch(props.url)
  expect(response.ok).toEqual(isPublic)
  if (isPublic) {
    expect(await response.text()).toEqual(testContent)
  }
  await files.delete(testFile)
}

describe('e2e tests using OpenWhisk credentials (as env vars)', () => {
  test('error bad credentials test: auth is ok but namespace is not', async () => {
    delete process.env.__OW_AUTH
    delete process.env.__OW_NAMESPACE
    process.env.__OW_AUTH = process.env.TEST_AUTH_1
    process.env.__OW_NAMESPACE = process.env.TEST_NAMESPACE_1 + 'bad'

    try {
      await filesLib.init()
    } catch (e) {
      expect({ name: e.name, code: e.code, message: e.message, sdkDetails: e.sdkDetails }).toEqual(expect.objectContaining({
        name: 'FilesLibError',
        code: 'ERROR_BAD_CREDENTIALS'
      }))
    }
  })

  test('read-write basic test using one file: read, write, read, delete, read', async () => {
    const files = await initFilesEnv()

    // 1. read file that does not exist
    await expectToThrowCode(files.read(testFile), 'ERROR_FILE_NOT_EXISTS')

    // 2. read file that exists
    expect(await files.write(testFile, testContent)).toEqual(testContent.length) // check write return value
    expect((await files.read(testFile)).toString()).toEqual(testContent)

    // 3. read deleted file
    expect(await files.delete(testFile)).toEqual([testFile])
    await expectToThrowCode(files.read(testFile), 'ERROR_FILE_NOT_EXISTS')
  })

  test('read with position and length: write, read subset of file content, read length bigger than size, read from position bigger than size (error)', async () => {
    const files = await initFilesEnv()

    await files.write(testFile, testContent)
    expect((await files.read(testFile, { position: 3, length: 4 })).toString()).toEqual('lo w')
    expect((await files.read(testFile, { length: 1000 })).toString()).toEqual(testContent)
    await expectToThrowCode(files.read(testFile, { position: 1000 }), 'ERROR_OUT_OF_RANGE')
  })
  test('private access test: write private file, get props, fetch url', async () => {
    await testACL(false)
  })
  test('public access test: write public file, get props, fetch url', async () => {
    await testACL(true)
  })

  test('list and delete tests: list empty root, write public and private files, list various public/private subdirs, delete', async () => {
    const files = await initFilesEnv()
    const testFiles = ['e2e/test/file.txt', 'e2e/testfile.txt', 'e2etestfile.txt', 'public/e2e/test/file.txt', 'public/e2e/testfile.txt', 'public/e2etestfile.txt', 'publice2etestfile.txt'].sort()

    // 1. list empty root
    expect(await files.list('/')).toEqual([])

    // 2. list file that doesn't exist
    expect(await files.list('afile')).toEqual([])

    // 3. list various public and private subfolders after adding files
    await Promise.all(testFiles.map(f => files.write(f, testContent)))
    /// 3.a. list root
    expect((await files.list('/')).sort()).toEqual(testFiles)
    /// 3.b list public files
    expect((await files.list('public')).sort()).toEqual(['public/e2e/test/file.txt', 'public/e2e/testfile.txt', 'public/e2etestfile.txt'].sort())
    /// 3.c.i list public files subdir 1
    expect((await files.list('public/e2e/')).sort()).toEqual(['public/e2e/test/file.txt', 'public/e2e/testfile.txt'].sort())
    /// 3.c.ii list public files subdir 2
    expect((await files.list('public/e2e/test/')).sort()).toEqual(['public/e2e/test/file.txt'].sort())
    /// 3.d.i list e2e/ (private subdir)
    expect((await files.list('e2e/')).sort()).toEqual(['e2e/test/file.txt', 'e2e/testfile.txt'].sort())
    /// 3.d.iii list e2e/test (private subdir)
    expect((await files.list('e2e/test/')).sort()).toEqual(['e2e/test/file.txt'])
    /// 3.e. list a (private) root file
    expect((await files.list('publice2etestfile.txt')).sort()).toEqual(['publice2etestfile.txt'].sort())
    /// 3.f. list a subfolder w/o ending with / => means file that does not exist
    expect((await files.list('e2e/test')).sort()).toEqual([])

    // 4. delete all files
    expect((await files.delete('/')).sort()).toEqual(testFiles)
  })

  test('stream test: write a readStream, create readStream, read the stream, expect content to be same', async () => {
    const files = await initFilesEnv()

    // 0. prepare read stream
    const Readable = require('stream').Readable
    const testStream = new Readable()
    testStream.push(testContent)
    testStream.push(null)

    // 1. write to remote file, check written size
    expect(await files.write(testFile, testStream)).toEqual(testContent.length)

    // 2. create readStream and read
    const s = await files.createReadStream(testFile)
    expect((await readStream(s)).toString()).toEqual(testContent)
  })

  test('isolation test: read, write, delete same file for two namespaces do not interfere', async () => {
    const files1 = await initFilesEnv(1)
    const files2 = await initFilesEnv(2)
    const testContent1 = 'e2e ONE'
    const testContent2 = 'e2e TWO'

    // 1. test that ns2 cannot read file in ns1
    await files1.write(testFile, testContent1)
    await expectToThrowCode(files2.read(testFile), 'ERROR_FILE_NOT_EXISTS')

    // 2. test that ns2 cannot update file in ns1
    await files2.write(testFile, testContent2)
    expect((await files1.read(testFile)).toString()).toEqual(testContent1)

    // 3. test that ns1 cannot delete file in ns2
    await files1.delete(testFile)
    expect((await files2.read(testFile)).toString()).toEqual(testContent2)

    // cleanup delete ns2 file
    await files2.delete(testFile)
  })
  test('copy dir local to remote to remote to local test', async () => {
    const files = await initFilesEnv()
    const testFiles = [
      'e2e/test/file.txt', 'e2e/test/file2.txt', 'e2e/test/file3.txt',
      'e2e/testfile.txt', 'e2e/testfile2.txt', 'e2e/testfile3.txt',
      'e2etestfile.txt', 'e2etestfile2.txt', 'e2etestfile3.txt'
    ].sort()

    // prepare files locally
    await fs.emptyDir(TEST_DIR)
    await fs.ensureDir(TEST_DIR + '/e2e/test/')
    const resFiles = testFiles.map(f => fullPath(f))
    await Promise.all(resFiles.map(f => fs.writeFile(f, testContent)))

    // 1. copy local dir to remote
    let map = await files.copy(TEST_DIR, '', { localSrc: true })
    expect(Object.keys(map).length).toEqual(resFiles.length)
    expect((await files.list('/')).sort()).toEqual(resFiles)

    // 2. copy remote to remote
    map = await files.copy(TEST_DIR + '/', 'otherDir/')
    expect(Object.keys(map).length).toEqual(resFiles.length)
    expect((await files.list('otherDir/')).sort()).toEqual(resFiles.map(f => 'otherDir/' + f))

    // 3. copy from remote to local
    map = await files.copy(TEST_DIR + '/', TEST_DIR + '/received/', { localDest: true })
    expect(Object.keys(map).length).toEqual(resFiles.length)
    expect(await fs.readdir(TEST_DIR + '/received/.e2e')).toEqual(['e2e', 'e2etestfile.txt', 'e2etestfile2.txt', 'e2etestfile3.txt'])
    expect(await fs.readdir(TEST_DIR + '/received/.e2e/e2e')).toEqual(['test', 'testfile.txt', 'testfile2.txt', 'testfile3.txt'])

    await fs.remove(TEST_DIR)
    await files.delete('/')
  })

  test('copy overwrite test local->remote->remote->local', async () => {
    const files = await initFilesEnv()
    // setup
    await fs.emptyDir(TEST_DIR)
    const fromFile = fullPath(testFile + 'src')
    const toOverwrite = fullPath(testFile)
    const toOverwrite2 = fullPath(testFile + '2')
    const newContent = 'some new content'
    await fs.writeFile(fromFile, newContent)
    await fs.writeFile(toOverwrite, testContent)
    await files.write(toOverwrite, testContent)
    await files.write(toOverwrite2, testContent)

    // 1.a. copy overwrite not allowed local -> remote
    let map = await files.copy(fromFile, toOverwrite, { localSrc: true, noOverwrite: true })
    expect(Object.keys(map).length).toEqual(0) // 0 file copied
    expect((await files.read(toOverwrite)).toString()).toEqual(testContent) // old content
    // 1.b this time with overwrite allowed
    map = await files.copy(fromFile, toOverwrite, { localSrc: true, noOverwrite: false })
    expect(Object.keys(map).length).toEqual(1) // 1 file copied
    expect((await files.read(toOverwrite)).toString()).toEqual(newContent) // new Content

    // 2.a copy overwrite not allowed remote -> remote
    // toOverwrite (remote) has the new content
    map = await files.copy(toOverwrite, toOverwrite2, { noOverwrite: true })
    expect(Object.keys(map).length).toEqual(0)
    expect((await files.read(toOverwrite2)).toString()).toEqual(testContent)
    // 2.b this time with overwrite allowed
    map = await files.copy(toOverwrite, toOverwrite2, { noOverwrite: false })
    expect(Object.keys(map).length).toEqual(1) // 1 file copied
    expect((await files.read(toOverwrite2)).toString()).toEqual(newContent)

    // 3.a copy overwrite not allowed remote -> local
    map = await files.copy(toOverwrite, toOverwrite, { localDest: true, noOverwrite: true })
    expect(Object.keys(map).length).toEqual(0)
    expect((await fs.readFile(toOverwrite)).toString()).toEqual(testContent)
    // 3.b this time with overwrite allowed
    map = await files.copy(toOverwrite, toOverwrite, { localDest: true, noOverwrite: false })
    expect(Object.keys(map).length).toEqual(1) // 1 file copied
    expect((await fs.readFile(toOverwrite)).toString()).toEqual(newContent)

    await fs.remove(TEST_DIR)
    await files.delete('/')
  })
})
