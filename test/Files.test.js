const { Files } = require('../lib/Files')

const fakeFile = 'fake/file.txt'

// TODO consider moving all function checks here?
// like bad filePath input or folder in read, ..
beforeEach(() => {
  expect.hasAssertions()
})

describe('with no provided implementation', () => {
  test('when init is called', async () => {
    await expect(Files.init.bind(Files)).toThrowNotImplemented('init')
  })
  test('when constructor is called', async () => {
    await expect(() => new Files()).toThrowNotImplemented('Files')
  })

  test('when list is called on a file', async () => {
    const storage = new Files(true)
    await expect(storage.list.bind(storage, fakeFile)).toThrowNotImplemented('_fileExists')
  })
  test('when list is called on a dir', async () => {
    const storage = new Files(true)
    await expect(storage.list.bind(storage, '/')).toThrowNotImplemented('_listFolder')
  })
  // read is implemented using createReadStream, could be left out of this test suite
  test('when read is called', async () => {
    const storage = new Files(true)
    await expect(storage.read.bind(storage, fakeFile)).toThrowNotImplemented('_createReadStream')
  })
  test('when write is called', async () => {
    const storage = new Files(true)
    await expect(storage.write.bind(storage, fakeFile, 'content')).toThrowNotImplemented('_writeBuffer')
  })
  test('when write is called on readable stream', async () => {
    const storage = new Files(true)
    await expect(storage.write.bind(storage, fakeFile, global.createStream('hello'))).toThrowNotImplemented('_writeStream')
  })
  test('when createReadStream is called', async () => {
    const storage = new Files(true)
    await expect(storage.createReadStream.bind(storage, fakeFile)).toThrowNotImplemented('_createReadStream')
  })
  test('when createWriteStream is called', async () => {
    const storage = new Files(true)
    await expect(storage.createWriteStream.bind(storage, fakeFile)).toThrowNotImplemented('_createWriteStream')
  })
  test('when delete is called', async () => {
    const storage = new Files(true)
    storage.list = jest.fn().mockResolvedValue([fakeFile])
    await expect(storage.delete.bind(storage, fakeFile)).toThrowNotImplemented('_deleteFile')
  })
  test('when getProperties is called', async () => {
    const storage = new Files(true)
    await expect(storage.getProperties.bind(storage, fakeFile)).toThrowNotImplemented('_getUrl')
  })
  test('when copy is called', async () => {
    const fakeFile2 = 'fake/file2.txt'
    const storage = new Files(true)
    storage.list = jest.fn().mockImplementation(f => { if (f === fakeFile) return [fakeFile]; else return [] })
    await expect(storage.copy.bind(storage, fakeFile, fakeFile2)).toThrowNotImplemented('_copyRemoteToRemoteFile')
  })
  test('when extracting status from provider error', async () => {
    const storage = new Files(true)
    await expect(storage._wrapProviderRequest.bind(storage, Promise.reject(new Error('hello')))).toThrowNotImplemented('_statusFromProviderError')
  })
})
