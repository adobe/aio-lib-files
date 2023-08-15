/* eslint-disable jest/expect-expect */
const { Files, FilePermissions, UrlType } = require('../lib/Files')
const upath = require('upath')
const stream = require('stream')
const fs = require('fs-extra')

jest.mock('fs-extra')

const ujoin = (...args) => upath.toUnix(upath.join(...args))
const ujoinFiles = (dirs, fakeFiles) => {
  if (!Array.isArray(dirs)) dirs = [dirs]
  return fakeFiles.map(f => ujoin(...dirs, f))
}
const fakeFile = 'fake/file.txt'
let initWithNewCredsMock = jest.spyOn(Files.prototype, '_initWithNewCreds')

beforeEach(() => {
  initWithNewCredsMock.mockImplementation(() => {})
})

afterEach(() => {
  initWithNewCredsMock.mockReset()
})

describe('init', () => {
  test('missing implementation', async () => {
    await global.expectToThrowNotImplemented(Files.init.bind(Files), 'init')
  })
})

describe('FilePermissions', () => {
  test('check available permissions', async () => {
    const obj = {
      READ: 'r',
      WRITE: 'w',
      DELETE: 'd'
    }
    expect(FilePermissions).toEqual(obj)
  })
})

describe('UrlType', () => {
  test('check available UrlType', async () => {
    const obj = {
      internal: 'internal',
      external: 'external'
    }
    expect(UrlType).toEqual(obj)
  })
})

describe('missing implementation', () => {
  const files = new Files()
  test('list', async () => {
    await expect(files.list('anything')).rejects.toThrow('not implemented')
    await expect(files.list('/')).rejects.toThrow('not implemented')
  })
  test('getFileInfo', async () => {
    await expect(files.getFileInfo('hello/../afile.txt')).rejects.toThrow('not implemented')
  })
  test('delete', async () => {
    await expect(files.delete('anything')).rejects.toThrow('not implemented')
  })
  test('createReadStream', async () => {
    await expect(files.createReadStream('anything')).rejects.toThrow('not implemented')
  })
  test('createWriteStream', async () => {
    await expect(files.createWriteStream('anything')).rejects.toThrow('not implemented')
  })
  test('getProperties', async () => {
    await expect(files.getProperties('anything')).rejects.toThrow('not implemented')
  })
  test('read', async () => {
    await expect(files.read('anything')).rejects.toThrow('not implemented')
  })
  test('write', async () => {
    await expect(files.write('anything', 'else')).rejects.toThrow('not implemented')
  })
  test('copy', async () => {
    await expect(files.copy('anything', 'somewheres')).rejects.toThrow('not implemented')
  })
  test('generatePresignURL', async () => {
    await expect(files.generatePresignURL('anything', {
      // Why call them options if they are required?
      expiryInSeconds: 100
    })).rejects.toThrow('not implemented')
  })
  test('_getPresignUrl', async () => {
    await expect(files._getPresignUrl('anything')).rejects.toThrow('not implemented')
  })
  test('_initWithNewCreds', async () => {
    initWithNewCredsMock.mockRestore()
    await expect(files._initWithNewCreds()).rejects.toThrow('not implemented')
    initWithNewCredsMock = jest.spyOn(Files.prototype, '_initWithNewCreds')
  })
})

describe('_isRemoteRoot + _isRemotePublic protected static base class methods', () => {
  test('return expected booleans', () => {
    class Implementor extends Files {
      isRemotePublic (usePath) {
        return Files._isRemotePublic(usePath)
      }

      isRemoteRoot (usePath) {
        return Files._isRemoteRoot(usePath)
      }
    }
    const instance = new Implementor()

    expect(instance.isRemotePublic).toBeDefined()
    expect(instance.isRemotePublic('')).toBe(false)
    expect(instance.isRemotePublic('/')).toBe(false)
    expect(instance.isRemotePublic(Files.publicPrefix)).toBe(true)
    expect(instance.isRemotePublic('not public')).toBe(false)

    expect(instance.isRemoteRoot).toBeDefined()
    expect(instance.isRemoteRoot('/')).toBe(false)
    expect(instance.isRemoteRoot('')).toBe(true)
    expect(instance.isRemoteRoot('not the root')).toBe(false)
  })
})

describe('_wrapProviderRequest', () => {
  test('return expected results', async () => {
    class Implementor extends Files {
      async wrapProviderRequest (requestPromise, details, filePathToThrowOn404) {
        return this._wrapProviderRequest(requestPromise, details, filePathToThrowOn404)
      }
    }
    const instance = new Implementor()
    expect(instance.wrapProviderRequest).toBeDefined()
    await expect(instance.wrapProviderRequest(Promise.resolve('ok'), 'details', true)).resolves.toBe('ok')
    await expect(instance.wrapProviderRequest(Promise.reject(new Error('just because')), 'details', true)).rejects.toThrow('ERROR_NOT_IMPLEMENTED')
  })
})

describe('list :: getInfo and _listFolder mock implementations', () => {
  const listFolderMock = jest.spyOn(Files.prototype, '_listFolder')
  const getFileInfo = jest.spyOn(Files.prototype, 'getFileInfo')

  const fakeFiles = (dir) => ujoinFiles(dir, ['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'])
  let files

  beforeEach(() => {
    files = new Files()
    listFolderMock.mockReset()
    getFileInfo.mockReset()
    // defaults that work
    initWithNewCredsMock.mockImplementation(() => {})
    listFolderMock.mockImplementation(async (...args) => fakeFiles(...args))
    getFileInfo.mockImplementation(async (...args) => { return { path: args[0] } })
  })

  afterAll(() => {
    listFolderMock.mockRestore()
  })

  test('when path is not a valid string', async () => {
    await global.expectToThrowBadArg(files.list.bind(files, 123), ['filePath', 'string'], { filePath: 123 })
  })

  test('when list(path) is an existing file', async () => {
    getFileInfo.mockImplementation(async () => { return { a: 9 } })
    let res = await files.list('hey.txt')
    expect(res).toEqual([{ a: 9 }])

    getFileInfo.mockImplementation(async () => null)
    res = await files.list('hey.txt')
    expect(res).toEqual([])
    expect(initWithNewCredsMock).toHaveBeenCalled()
  })

  test('when path is an existing file with a non normalized path', async () => {
    const res = await files.list('hello/../afile.txt')
    expect(res).toEqual([expect.objectContaining({ path: 'afile.txt' })])
    expect(getFileInfo).toHaveBeenCalledWith('afile.txt')
    expect(listFolderMock).toHaveBeenCalledTimes(0)
    expect(initWithNewCredsMock).toHaveBeenCalled()
  })

  test('when path is a non existing file', async () => {
    const { codes } = require('../lib/./FilesError')
    getFileInfo.mockRejectedValue(new codes.ERROR_FILE_NOT_EXISTS({ messageValues: ['file'] }))
    const res = await files.list('afile.txt')
    expect(res).toEqual([])
    expect(listFolderMock).toHaveBeenCalledTimes(0)
    expect(initWithNewCredsMock).toHaveBeenCalled()
  })

  test('when path is a non existing file (2)', async () => {
    getFileInfo.mockImplementation(async (...args) => { return null })
    const res = await files.list('afile.txt')
    expect(res).toEqual([])
    expect(listFolderMock).toHaveBeenCalledTimes(0)
    expect(initWithNewCredsMock).toHaveBeenCalled()
  })

  const testRootFolder = async (dir) => {
    const res = await files.list(dir)
    expect(res).toEqual(fakeFiles(''))
    expect(listFolderMock).toHaveBeenCalledTimes(1)
    expect(initWithNewCredsMock).toHaveBeenCalled()
  }

  test('when path is undefined (root folder)', async () => testRootFolder()) // eslint-disable-line jest/expect-expect
  test('when path is / (root folder)', async () => testRootFolder('/')) // eslint-disable-line jest/expect-expect
  test('when path is \'\' (root folder)', async () => testRootFolder('')) // eslint-disable-line jest/expect-expect
  test('when path is \'.\' (root folder)', async () => testRootFolder('.')) // eslint-disable-line jest/expect-expect

  test('when path is a non normalized directory', async () => {
    const res = await files.list('hello/../hi/')
    expect(res).toEqual(fakeFiles('hi/'))
    expect(listFolderMock).toHaveBeenCalledWith('hi/')
  })
  test('when path is an empty directory', async () => {
    listFolderMock.mockResolvedValue([])
    const res = await files.list('hello/../hi/')
    expect(res).toEqual([])
  })
})

describe('delete', () => {
  test('missing _deleteFile implementation', async () => {
    const files = new Files()
    files.list = jest.fn().mockResolvedValue([fakeFile])
    await global.expectToThrowNotImplemented(files.delete.bind(files, fakeFile), '_deleteFile')
  })

  describe('list and _deleteFile mock implementations', () => {
    const listMock = jest.spyOn(Files.prototype, 'list')
    const deleteFileMock = jest.spyOn(Files.prototype, '_deleteFile')
    let files

    beforeEach(() => {
      files = new Files()
      listMock.mockReset()
      deleteFileMock.mockReset()

      deleteFileMock.mockImplementation(f => Promise.resolve(f))
    })

    afterAll(() => {
      deleteFileMock.mockRestore()
      listMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await global.expectToThrowBadArg(files.delete.bind(files, 123), ['filePath', 'string'], { filePath: 123, options: {} })
    })

    test('when progressCallback is not a valid function', async () => {
      await global.expectToThrowBadArg(files.delete.bind(files, 'afile', { progressCallback: 'astring' }), ['progressCallback', 'function'], { filePath: 'afile', options: { progressCallback: 'astring' } })
    })

    test('with a bad option', async () => {
      await global.expectToThrowBadArg(files.delete.bind(files, 'afile', { some__wrong__option: 'astring' }), ['some__wrong__option'], { filePath: 'afile', options: { some__wrong__option: 'astring' } })
    })

    const testDelete = async (listedFiles, hasPgCb) => {
      const progressCallback = jest.fn()
      const fakeRes = ujoinFiles('some/dir/', listedFiles)
      listMock.mockResolvedValue(fakeRes)
      const res = await files.delete('some/dir/', hasPgCb ? { progressCallback } : undefined)
      expect(res).toEqual(fakeRes)
      fakeRes.forEach(f => {
        expect(deleteFileMock).toHaveBeenCalledWith(f)
      })
      if (hasPgCb) expect(progressCallback).toHaveBeenCalledTimes(fakeRes.length)
      // test logs
      expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('' + listedFiles.length))
    }

    test('delete a single file without progress callback', async () => testDelete(['a/b/c/d.txt'], false)) // eslint-disable-line jest/expect-expect
    test('delete multiple files without progress callback', async () => testDelete(['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'], false)) // eslint-disable-line jest/expect-expect
    test('delete a single file with progress callback', async () => testDelete(['a/b/c/d.txt'], true)) // eslint-disable-line jest/expect-expect
    test('delete multiple files with progress callback', async () => testDelete(['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'], true)) // eslint-disable-line jest/expect-expect
  })
})

describe('createReadStream', () => {
  test('missing _createReadStream implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files.createReadStream.bind(files, fakeFile), '_createReadStream')
  })

  describe('_createReadStream mock implementations', () => {
    const createReadStreamMock = jest.spyOn(Files.prototype, '_createReadStream')
    let fakeRdStream
    let files

    beforeEach(() => {
      files = new Files()
      fakeRdStream = new stream.Readable()
      fakeRdStream.push(null)
      createReadStreamMock.mockReset()
      createReadStreamMock.mockResolvedValue(fakeRdStream)
    })

    afterAll(() => {
      createReadStreamMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, 123), ['filePath', 'string'], { filePath: 123, options: {} })
    })

    test('when path is undefined', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files), ['filePath', 'required'], { filePath: undefined, options: {} })
    })

    test('when path is a dir (not allowed)', async () => {
      await global.expectToThrowBadFileType(files.createReadStream.bind(files, 'a/dir/'), 'a/dir/', { filePath: 'a/dir/', options: {} })
    })

    test('when options.position is not a number', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, fakeFile, { position: 'astring' }), ['position', 'number'], { filePath: fakeFile, options: { position: 'astring' } })
    })

    test('when options.length is not a number', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, fakeFile, { length: 'astring' }), ['length', 'number'], { filePath: fakeFile, options: { length: 'astring' } })
    })

    test('when options.position is smaller than 0', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, fakeFile, { position: -1 }), ['position', 'greater', '0'], { filePath: fakeFile, options: { position: -1 } })
    })

    test('when options.length is smaller than 0', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, fakeFile, { length: -1 }), ['length', 'greater', '0'], { filePath: fakeFile, options: { length: -1 } })
    })

    test('with a bad option', async () => {
      await global.expectToThrowBadArg(files.createReadStream.bind(files, fakeFile, { some__wrong__option: 'astring' }), ['some__wrong__option'], { filePath: fakeFile, options: { some__wrong__option: 'astring' } })
    })

    const testCreateReadStream = async (options) => {
      const res = await files.createReadStream('hello/../file', options) // test with non normalized path
      expect(res).toEqual(fakeRdStream)
      // must set defaults:
      if (!options) options = {}
      options.position = options.position || 0
      expect(createReadStreamMock).toHaveBeenCalledWith('file', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
    }

    test('when options are undefined and path is non normalized', async () => testCreateReadStream()) // eslint-disable-line jest/expect-expect
    test('when options.position is a number', async () => testCreateReadStream({ position: 1 })) // eslint-disable-line jest/expect-expect
    test('when options.length is a number', async () => testCreateReadStream({ length: 10 })) // eslint-disable-line jest/expect-expect
    test('when options.length and options.positions are numbers', async () => testCreateReadStream({ position: 1, length: 10 })) // eslint-disable-line jest/expect-expect
  })
})

describe('createWriteStream', () => {
  test('missing _createWriteStream implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files.createWriteStream.bind(files, fakeFile), '_createWriteStream')
  })

  describe('_createWriteStream mock implementations', () => {
    const createWriteStreamMock = jest.spyOn(Files.prototype, '_createWriteStream')
    let files
    const fakeWriteStream = new stream.Writable()

    beforeEach(() => {
      files = new Files()
      createWriteStreamMock.mockReset()
      createWriteStreamMock.mockResolvedValue(fakeWriteStream)
    })

    afterAll(() => {
      createWriteStreamMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await global.expectToThrowBadArg(files.createWriteStream.bind(files, 123), ['filePath', 'string'], { filePath: 123 })
    })

    test('when path is undefined', async () => {
      await global.expectToThrowBadArg(files.createWriteStream.bind(files, undefined), ['filePath', 'required'], { filePath: undefined })
    })

    test('when path is a dir (not allowed)', async () => {
      await global.expectToThrowBadFileType(files.createWriteStream.bind(files, 'a/dir/'), 'a/dir/', { filePath: 'a/dir/' })
    })

    test('when file is a non normalized path', async () => {
      const res = await files.createWriteStream('hello/../file')
      expect(res).toEqual(fakeWriteStream)
      expect(createWriteStreamMock).toHaveBeenCalledWith('file')
      expect(initWithNewCredsMock).toHaveBeenCalled()
    })
  })
})

describe('read', () => {
  test('missing _createReadStream implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files.read.bind(files, fakeFile), '_createReadStream')
  })

  describe('createReadStream mock implementation', () => {
    // here we mock createReadStream which is used by read, while this test exposes implementation details that might
    // change (e.g. in case read doesn't use createReadStream anymore), it is easier to test for now (e.g. no need to repeat
    // checks of createReadStream)
    const createReadStreamMock = jest.spyOn(Files.prototype, 'createReadStream')
    const fakeContent = 'some fake content @#$%^&*()@!12-=][;"\n\trewq'
    const fakeOptions = { position: 1, length: 10 }
    let fakeRdStream
    let files

    beforeEach(() => {
      files = new Files()
      fakeRdStream = new stream.Readable()
      fakeRdStream.push(fakeContent)
      fakeRdStream.push(null)
      createReadStreamMock.mockReset()
      createReadStreamMock.mockResolvedValue(fakeRdStream)
    })

    afterAll(() => {
      createReadStreamMock.mockRestore()
    })

    test('read file', async () => {
      const res = await files.read(fakeFile, fakeOptions)
      expect(res).toBeInstanceOf(Buffer)
      expect(res.toString()).toEqual(fakeContent)
      expect(createReadStreamMock).toHaveBeenCalledWith(fakeFile, fakeOptions)
    })
  })
})

describe('write', () => {
  test('missing _writeBuffer implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files.write.bind(files, fakeFile, 'content'), '_writeBuffer')
  })

  test('missing _writeStream implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files.write.bind(files, fakeFile, global.createStream('hello')), '_writeStream')
  })

  describe('_writeBuffer and _writeStream mock implementations', () => {
    const writeBufferMock = jest.spyOn(Files.prototype, '_writeBuffer')
    const writeStreamMock = jest.spyOn(Files.prototype, '_writeStream')
    let files

    beforeEach(() => {
      files = new Files()
      writeBufferMock.mockReset()
      writeStreamMock.mockReset()
    })

    afterAll(() => {
      writeBufferMock.mockRestore()
      writeStreamMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, 123, 'content'), ['filePath', 'string'], { filePath: 123, contentType: 'String' })
    })

    test('when path undefined', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, undefined, 'content'), ['filePath', 'required'], { filePath: undefined, contentType: 'String' })
    })

    test('when content is undefined', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, fakeFile, undefined), ['content', 'required'], { filePath: fakeFile, contentType: undefined })
    })

    test('when content is null', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, fakeFile, null), ['content', 'string', 'binary'], { filePath: fakeFile, contentType: undefined })
    })

    test('when content is a number', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, fakeFile, 123), ['content', 'string', 'binary'], { filePath: fakeFile, contentType: 'Number' })
    })

    test('when path is a dir (not allowed)', async () => {
      await global.expectToThrowBadFileType(files.write.bind(files, 'a/dir/', 'content'), 'a/dir/', { filePath: 'a/dir/', contentType: 'String' })
    })

    const testWrite = async (content) => {
      writeBufferMock.mockResolvedValue(42)
      writeStreamMock.mockResolvedValue(42)
      const res = await files.write('hello/../file', content) // test with non normalized string
      expect(res).toEqual(42)

      if (content instanceof stream.Readable) {
        expect(writeStreamMock).toHaveBeenCalledWith('file', content)
      } else if (typeof content === 'string') {
        expect(writeBufferMock).toHaveBeenCalledWith('file', expect.any(Buffer))
        expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('' + content.length))
      } else {
        expect(writeBufferMock).toHaveBeenCalledWith('file', content)
        expect(global.mockLogDebug).toHaveBeenCalledWith(expect.stringContaining('' + content.length))
      }
      expect(initWithNewCredsMock).toHaveBeenCalled()
    }

    test('when file is a non normalized path and content is a string', async () => testWrite('hello')) // eslint-disable-line jest/expect-expect
    test('when content is a buffer', async () => testWrite(Buffer.from('hello'))) // eslint-disable-line jest/expect-expect
    test('when content is a readable stream', async () => testWrite(new stream.Readable())) // eslint-disable-line jest/expect-expect
  })
})

describe('getProperties', () => {
  test('missing _getUrl implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files._getUrl.bind(files, fakeFile), '_getUrl')
  })
})

describe('_getUrl mock implementation', () => {
  const getUrlMock = jest.spyOn(Files.prototype, '_getUrl')
  const getFileInfoMock = jest.spyOn(Files.prototype, 'getFileInfo')
  let files
  const fakeUrl = 'http://fake.com'

  beforeEach(() => {
    files = new Files()
    getFileInfoMock.mockImplementation(() => {})
    getUrlMock.mockReturnValue(fakeUrl)
  })

  afterEach(() => {
    getFileInfoMock.mockReset()
    getUrlMock.mockReset()
  })

  afterAll(() => {
    getUrlMock.mockRestore()
    getFileInfoMock.mockRestore()
  })

  test('when path is not a valid string', async () => {
    await global.expectToThrowBadArg(files.write.bind(files, 123), ['filePath', 'string'], { filePath: 123 })
  })

  test('when path undefined', async () => {
    await global.expectToThrowBadArg(files.write.bind(files, undefined), ['filePath', 'required'], { filePath: undefined })
  })

  test('when filePath is non normalized', async () => {
    await files.getProperties('hello/../file')
    expect(getFileInfoMock).toHaveBeenCalledWith('file')
  })

  test('when filePath is a private file', async () => {
    getFileInfoMock.mockReturnValue({
      isDirectory: false,
      isPublic: false,
      url: fakeUrl,
      internalUrl: 'http://fake.com'
    })
    const res = await files.getProperties('a/private/file')
    expect(res).toEqual({
      isDirectory: false,
      isPublic: false,
      url: fakeUrl,
      internalUrl: 'http://fake.com'
    })
  })

  test('when filePath is a public file', async () => {
    getFileInfoMock.mockReturnValue({
      isDirectory: false,
      isPublic: true,
      url: fakeUrl
    })
    const res = await files.getProperties('public/file')
    expect(res).toEqual({
      isDirectory: false,
      isPublic: true,
      url: fakeUrl
    })
  })
})

describe('_statusFromProviderError', () => {
  test('missing implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files._statusFromProviderError.bind(files, 'error'), '_statusFromProviderError')
  })
})

describe('copy', () => {
  test('missing _copyRemoteToRemoteFile (for remote/remote case)', async () => {
    const fakeFile2 = 'fake/file2.txt'
    const files = new Files()
    files.list = jest.fn().mockImplementation(f => { if (f === fakeFile) return [fakeFile]; else return [] })
    await global.expectToThrowNotImplemented(files._copyRemoteToRemoteFile.bind(files, fakeFile, fakeFile2), '_copyRemoteToRemoteFile')
  })

  describe('bad input', () => {
    let files

    beforeEach(() => {
      files = new Files()
    })

    test('when srcPath is not a valid string', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 123, 'dest'),
        ['srcPath', 'string'],
        { srcPath: 123, destPath: 'dest', options: {} })
    })

    test('when destPath is not a valid string', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 123),
        ['destPath', 'string'],
        { srcPath: 'src', destPath: 123, options: {} })
    })

    test('when srcPath is undefined', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, undefined, 'dest'),
        ['srcPath', 'required'],
        { srcPath: undefined, destPath: 'dest', options: {} })
    })

    test('when destPath undefined', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', undefined),
        ['destPath', 'required'],
        { srcPath: 'src', destPath: undefined, options: {} })
    })

    test('when options.noOverwrite is not a boolean', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 'dest', { noOverwrite: 1234 }),
        ['noOverwrite', 'boolean'],
        { srcPath: 'src', destPath: 'dest', options: { noOverwrite: 1234 } })
    })

    test('when options.localSrc is not a boolean', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 'dest', { localSrc: 1234 }),
        ['localSrc', 'boolean'],
        { srcPath: 'src', destPath: 'dest', options: { localSrc: 1234 } })
    })

    test('when options.localDest is not a boolean', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 'dest', { localDest: 1234 }),
        ['localDest', 'boolean'],
        { srcPath: 'src', destPath: 'dest', options: { localDest: 1234 } })
    })

    test('when options.progressCallback is not a function', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 'dest', { progressCallback: 1234 }),
        ['progressCallback', 'function'],
        { srcPath: 'src', destPath: 'dest', options: { progressCallback: 1234 } })
    })

    test('when both options.localSrc and options.localDest are specified', async () => {
      await global.expectToThrowBadArg(files.copy.bind(files, 'src', 'dest', { localDest: true, localSrc: true }),
        ['localDest', 'localSrc'],
        { srcPath: 'src', destPath: 'dest', options: { localDest: true, localSrc: true } })
    })
  })

  describe('copy logic', () => {
    /** @type {Files} */
    let files
    // local and remote files
    let remoteFakeDirFiles
    const fakeFs = global.fakeFs()
    // with local src or dest
    const fsStatMock = jest.spyOn(fs, 'stat')
    const fsReaddirMock = jest.spyOn(fs, 'readdir')
    const fsPathExistsMock = jest.spyOn(fs, 'pathExists')
    // local -> remote
    const fsCreateReadStreamMock = jest.spyOn(fs, 'createReadStream')
    // remote -> local
    const fsCreateWriteStreamMock = jest.spyOn(fs, 'createWriteStream')

    beforeEach(() => {
      /* **** MOCKS **** */
      fakeFs.reset()
      files = new Files()
      // all cases - list
      remoteFakeDirFiles = new Set([])
      files.list = jest.fn().mockImplementation(async file => {
        file = file || ''
        file = upath.toUnix(file)
        if (file.endsWith('/')) {
          // is dir
          return [...remoteFakeDirFiles].filter(f => f.startsWith(file))
        }
        return (remoteFakeDirFiles.has(file) && [file]) || []
      })
      // remote <-> remote
      files._copyRemoteToRemoteFile = jest.fn()
      // remote -> local
      files.createReadStream = jest.fn().mockResolvedValue(global.createStream('hello'))
      // local -> remote
      files.write = jest.fn()

      fsStatMock.mockReset()
      fsReaddirMock.mockReset()
      fsPathExistsMock.mockReset()
      fsCreateReadStreamMock.mockReset()
      fsCreateWriteStreamMock.mockReset()

      fsStatMock.mockImplementation(fakeFs.stat)
      fsReaddirMock.mockImplementation(fakeFs.readdir)
      fsPathExistsMock.mockImplementation(fakeFs.pathExists)
      fsCreateReadStreamMock.mockImplementation(fakeFs.createReadStream)
      fsCreateWriteStreamMock.mockImplementation(() => new stream.Writable({ write: (chunk, enc, next) => { next() } }))
    })

    afterAll(() => {
      fsStatMock.mockRestore()
      fsReaddirMock.mockRestore()
      fsPathExistsMock.mockRestore()
      fsCreateReadStreamMock.mockRestore()
      fsCreateWriteStreamMock.mockRestore()
    })

    /* **** HELPERS **** */
    const arraysToObject = (a, b) => a.reduce((obj, curr, i) => { obj[curr] = b[i]; return obj }, {})

    const addFiles = (filesToAdd = [], options = { local: false, prefix: '', isSymlink: false }) => {
      if (!Array.isArray(filesToAdd)) filesToAdd = [filesToAdd]
      filesToAdd = ujoinFiles(options.prefix || '', filesToAdd)

      if (options.local) {
        filesToAdd.map(f => fakeFs.addFile(f, options.isSymlink ? 'SYMLINK' : 'fake content'))
      } else {
        filesToAdd.map(f => remoteFakeDirFiles.add(f))
      }
      return filesToAdd
    }

    /* **** CONST **** */
    const fakeSrcDir = 'src/subsrc/' // !! important must end with /
    const fakeDestDir = 'dest/subdest/' // !! important must end with /
    const fakeSrcFile = ujoin(fakeSrcDir, 'file1')
    const fakeDestFile = ujoin(fakeDestDir, 'file2')
    const fakeFiles = ['a', 'b/c/d/e.txt', 'f/g/h', 'f/g/ii.iiiiii'] // !! important must at least contain 4 elements
    const fakeFiles2 = ['j', 'k/l/m/n.txt', 'o/p/q', 'o/p/rr.rrrrr'] // !! important must at least contain 4 elements

    /* **** GENERIC TESTS **** */
    const testCopyOk = async (src, dest, options, expected) => {
      // transform expected to absolute path if local
      const uResolve = p => upath.toUnix(upath.resolve(p))
      if (options.localDest) {
        expected = Object.keys(expected).reduce((obj, k) => {
          obj[k] = uResolve(expected[k])
          return obj
        }, {})
      }

      if (options.localSrc) {
        expected = Object.keys(expected).reduce((obj, k) => {
          obj[uResolve(k)] = expected[k]
          return obj
        }, {})
      }

      const expectedEntries = Object.entries(expected)
      const numberOfFiles = expectedEntries.length

      // expected is a key value src -> dest
      const res = await files.copy(src, dest, options)
      expect(res).toEqual(expected)

      if (options.progressCallback) {
        expect(options.progressCallback).toHaveBeenCalledTimes(numberOfFiles)
        if (numberOfFiles) expect(options.progressCallback).toHaveBeenCalledWith(expectedEntries[0][0], expectedEntries[0][1]) // just check first key value
      }
      if (options.localSrc) {
        expect(files.write).toHaveBeenCalledTimes(numberOfFiles)
        if (numberOfFiles) expect(files.write).toHaveBeenCalledWith(expectedEntries[0][1], expect.any(stream.Readable)) // make sure called on dest and with stream (for perf reasons)
        expect(fsCreateReadStreamMock).toHaveBeenCalledTimes(numberOfFiles)
        if (numberOfFiles) expect(fsCreateReadStreamMock).toHaveBeenCalledWith(expectedEntries[0][0]) // called on src file
        return
      }
      if (options.localDest) {
        expect(files.createReadStream).toHaveBeenCalledTimes(numberOfFiles)
        if (numberOfFiles) expect(files.createReadStream).toHaveBeenCalledWith(expectedEntries[0][0])
        expect(fsCreateWriteStreamMock).toHaveBeenCalledTimes(numberOfFiles)
        if (numberOfFiles) expect(fsCreateWriteStreamMock).toHaveBeenCalledWith(expectedEntries[0][1])
        return
      }
      // remote <-> remote
      expect(files._copyRemoteToRemoteFile).toHaveBeenCalledTimes(numberOfFiles)
      if (numberOfFiles) expect(files._copyRemoteToRemoteFile).toHaveBeenCalledWith(expectedEntries[0][0], expectedEntries[0][1])

      expect(initWithNewCredsMock).toHaveBeenCalled()
    }
    const allGenericCopyTests = (localSrc = undefined, localDest = undefined) => {
      const localOptions = { localSrc, localDest }

      /* ** src does not exist ** */

      test('when src does not exist', async () => {
        addFiles([], { local: localSrc })
        await global.expectToThrowFileNotExists(files.copy.bind(files, fakeSrcFile, fakeDestFile, localOptions), fakeSrcFile, { srcPath: fakeSrcFile, destPath: fakeDestFile, options: localOptions })
      })

      /* ** dest does not exist ** */

      test('when src is a file and dest does not exist', async () => {
        addFiles([fakeSrcFile], { local: localSrc })
        await testCopyOk(fakeSrcFile, fakeDestFile, localOptions, { [fakeSrcFile]: fakeDestFile })
      })

      test('when src is a dir and dest does not exist (dir/)', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, localOptions, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)))
      })

      test('when src is a dir and dest does not exist (file)', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        await testCopyOk(fakeSrcDir, fakeDestFile, localOptions, arraysToObject(srcFiles, ujoinFiles(fakeDestFile, fakeFiles)))
      })

      /* ** src and dest are files ** */

      test('when src and dest are files', async () => {
        addFiles([fakeSrcFile], { local: localSrc })
        addFiles([fakeDestFile], { local: localDest })
        await testCopyOk(fakeSrcFile, fakeDestFile, localOptions, { [fakeSrcFile]: fakeDestFile })
      })

      test('when src and dest are files and noOverwrite set to true and progressCallback is set', async () => {
        addFiles([fakeSrcFile], { local: localSrc })
        addFiles([fakeDestFile], { local: localDest })
        await testCopyOk(fakeSrcFile, fakeDestFile, { ...localOptions, noOverwrite: true, progressCallback: jest.fn() }, {})
      })

      test('when src and dest are files and progressCallback is set', async () => {
        addFiles([fakeSrcFile], { local: localSrc })
        addFiles([fakeDestFile], { local: localDest })
        await testCopyOk(fakeSrcFile, fakeDestFile, { ...localOptions, progressCallback: jest.fn() }, { [fakeSrcFile]: fakeDestFile })
      })

      /* ** src is a file and dest is a dir ** */

      test('when src is a file and dest is an existing dir containing a different file', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, localOptions, { a: ujoin(fakeDestDir, 'a') })
      })

      test('when src is a file and dest is an existing dir containing a different file and noOverwrite and progressCallback', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true, progressCallback: jest.fn() }, { a: ujoin(fakeDestDir, 'a') })
      })

      test('when src is a file and dest is an existing dir with same name as file', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b'], { local: localDest, prefix: 'a' })
        await testCopyOk('a', 'a/', localOptions, { a: 'a/a' })
      })

      test('when src is a file and dest is an existing dir which contain the same file name', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, localOptions, { a: ujoin(fakeDestDir, 'a') })
      })

      test('when src is a file and dest is an existing dir which contain the same file name and noOverwrite = true', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true }, {})
      })

      test('when src is a file and dest has a subdir with the same file name and noOverwrite = true', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b/a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true }, { a: ujoin(fakeDestDir, 'a') })
      })

      /* ** src and dest are dirs ** */

      test('when src and dest are dirs containing different files', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles2, { local: localDest, prefix: fakeDestDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, localOptions, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)))
      })

      test('when src and dest are dirs containing same files and dest ends with /', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles, { local: localDest, prefix: fakeDestDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, localOptions, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)))
      })

      test('when src and dest are dirs containing same files and dest ends with / and noOverwrite and progressCallback are set', async () => {
        // is still ok to copy as we copy to dest/src/files
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles, { local: localDest, prefix: fakeDestDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, { ...localOptions, progressCallback: jest.fn(), noOverwrite: true }, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)))
      })

      test('when src and dest are dirs and dest contains subfolder with src basname with same files and dest ends with /', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(ujoinFiles(upath.basename(fakeSrcDir), fakeFiles), { local: localDest, prefix: fakeDestDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, localOptions, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)))
      })

      test('when src and dest are dirs and dest contains subfolder with src basename with same files and dest ends with / and noOverwrite and progressCallback are set', async () => {
        addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(ujoinFiles(upath.basename(fakeSrcDir), fakeFiles), { local: localDest, prefix: fakeDestDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, { ...localOptions, progressCallback: jest.fn(), noOverwrite: true }, {})
      })

      test('when src and dest are dirs containing same files but dest does not end with `/`', async () => {
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles, { local: localDest, prefix: fakeDestDir })
        // if dest is an existing **LOCAL** dir behaviour is like ending with a /
        const expected = localDest ? arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)) : arraysToObject(srcFiles, ujoinFiles(fakeDestDir, fakeFiles))
        await testCopyOk(fakeSrcDir, fakeDestDir.slice(0, -1), localOptions, expected)
      })

      test('when src and dest are dirs containing same files but dest does not end with `/` and **noOverwrite** and progressCallback are set', async () => {
        // this time does not copy as we copy to dest/files
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles, { local: localDest, prefix: fakeDestDir })
        // if dest is an existing **LOCAL** dir behaviour is like ending with a / so no overwrite
        const expected = localDest ? arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)) : {}
        await testCopyOk(fakeSrcDir, fakeDestDir.slice(0, -1), { ...localOptions, progressCallback: jest.fn(), noOverwrite: true }, expected)
      })

      test('when src and dest are dirs and dest does not end with `/` and contains 2 files that are contained by src and **noOverwrite** and progressCallback are set', async () => {
        // here we test that just some files are copied
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles(fakeFiles.slice(0, 2), { local: localDest, prefix: fakeDestDir })
        // if dest is an existing **LOCAL** dir behaviour is like ending with a / so no overwrite
        const expected = localDest ? arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], fakeFiles)) : arraysToObject(srcFiles.slice(2), ujoinFiles(fakeDestDir, fakeFiles.slice(2)))
        await testCopyOk(fakeSrcDir, fakeDestDir.slice(0, -1), { ...localOptions, progressCallback: jest.fn(), noOverwrite: true }, expected)
      })

      /* ** src is a dir and dest is a file ** */

      test('when src is a dir and dest an existing file and noOverwrite and progressCallback are set', async () => {
        // noOverwrite does not matter here in remote setup allowed anyways
        // if dest is local though should throw an error as we cannot copy a dir to a file
        const srcFiles = addFiles(fakeFiles, { local: localSrc, prefix: fakeSrcDir })
        addFiles([fakeDestFile], { local: localDest })
        const options = { ...localOptions, progressCallback: jest.fn(), noOverwrite: true }
        if (localDest) {
          await global.expectToThrowBadFileType(files.copy.bind(files, fakeSrcDir, fakeDestFile, options), fakeDestFile, { srcPath: fakeSrcDir, destPath: fakeDestFile, options })
          return
        }
        await testCopyOk(fakeSrcDir, fakeDestFile, options, arraysToObject(srcFiles, ujoinFiles(fakeDestFile, fakeFiles)))
      })
    }

    // /* **** ACTUAL TESTS **** */
    describe('remote <-> remote', () => {
      allGenericCopyTests()
    })

    describe('local -> remote', () => {
      allGenericCopyTests(true, undefined)

      test('local src is symlink', async () => {
        addFiles([fakeSrcFile], { local: true, isSymlink: true })
        await global.expectToThrowBadFileType(files.copy.bind(files, fakeSrcFile, fakeDestFile, { localSrc: true }), fakeSrcFile, { srcPath: fakeSrcFile, destPath: fakeDestFile, options: { localSrc: true } })
      })

      test('local src is a directory containing a symlink', async () => {
        // is fine if symlink is within folder should just get ignored
        addFiles(['symlinkFile'], { local: true, isSymlink: true, prefix: fakeSrcDir })
        const srcFiles = addFiles(['b/a'], { local: true, prefix: fakeSrcDir })
        await testCopyOk(fakeSrcDir, fakeDestDir, { localSrc: true }, arraysToObject(srcFiles, ujoinFiles([fakeDestDir, upath.basename(fakeSrcDir)], ['b/a'])))
      })

      test('fs.stat throws other error than ENOENT', async () => {
        const fakeError = new Error('myerror')
        fakeError.code = 'FAKE'
        fsStatMock.mockRejectedValue(fakeError)
        addFiles([fakeSrcFile], { local: false })
        addFiles([fakeDestFile], { local: true })
        try {
          await files.copy(fakeSrcFile, fakeDestFile, { localSrc: true })
        } catch (e) {
          // eslint-disable-next-line jest/no-try-expect
          expect(e).toEqual(fakeError)
        }
      })
    })

    describe('remote -> local', () => {
      allGenericCopyTests(undefined, true)

      test('local dest is symlink', async () => {
        addFiles([fakeSrcFile], { local: false })
        addFiles([fakeDestFile], { local: true, isSymlink: true })
        await global.expectToThrowBadFileType(files.copy.bind(files, fakeSrcFile, fakeDestFile, { localDest: true }), fakeDestFile, { srcPath: fakeSrcFile, destPath: fakeDestFile, options: { localDest: true } })
      })

      test('fs.stat throws other error than ENOENT', async () => {
        const fakeError = new Error('myerror')
        fakeError.code = 'FAKE'
        fsStatMock.mockRejectedValue(fakeError)
        addFiles([fakeSrcFile], { local: false })
        addFiles([fakeDestFile], { local: true })
        try {
          await files.copy(fakeSrcFile, fakeDestFile, { localDest: true })
        } catch (e) {
          // eslint-disable-next-line jest/no-try-expect
          expect(e).toEqual(fakeError)
        }
      })
    })
  })
})

describe('generatePresignURL', () => {
  test('missing _getPresignUrl implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files._getPresignUrl.bind(files, fakeFile), '_getPresignUrl')
  })

  describe('_getPresignUrl mock implementation', () => {
    const getPresignUrlMock = jest.spyOn(Files.prototype, '_getPresignUrl')
    const options = { expiryInSeconds: 30 }
    let files
    const fakeUrl = 'http://fake.com'

    beforeEach(() => {
      files = new Files()
      getPresignUrlMock.mockReset()
      getPresignUrlMock.mockReturnValue(fakeUrl)
    })

    afterAll(() => {
      getPresignUrlMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, 123), ['filePath', 'string'], { filePath: 123 })
    })

    test('when path undefined', async () => {
      await global.expectToThrowBadArg(files.write.bind(files, undefined), ['filePath', 'required'], { filePath: undefined })
    })

    test('when filePath is non normalized', async () => {
      await files.generatePresignURL('hello/../file', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(getPresignUrlMock).toHaveBeenCalledWith('file', { expiryInSeconds: 30 })
    })

    test('when filePath is a private file', async () => {
      const res = await files.generatePresignURL('a/private/file', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(res).toEqual('http://fake.com')
    })

    test('when filePath is a public file', async () => {
      const res = await files.generatePresignURL('public/file', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(res).toEqual('http://fake.com')
    })

    test('when filePath is a private path starting with `public` (publicisnotpublicfile.txt)', async () => {
      const res = await files.generatePresignURL('publicisnotpublicfile.txt', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(res).toEqual('http://fake.com')
    })

    test('when filePath is a public dir', async () => {
      const res = await files.generatePresignURL('public/dir/', options)
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(res).toEqual('http://fake.com')
    })
  })
})

describe('revokeAllPresignURLs', () => {
  test('missing _revokeAllPresignURLs implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files._revokeAllPresignURLs.bind(files, fakeFile), '_revokeAllPresignURLs')
  })

  describe('_revokeAllPresignURLs mock implementation', () => {
    const revokePresignUrlMock = jest.spyOn(Files.prototype, '_revokeAllPresignURLs')

    let files
    const fakeRes = {}

    beforeEach(() => {
      files = new Files()
      revokePresignUrlMock.mockReset()
      revokePresignUrlMock.mockReturnValue(fakeRes)
    })

    afterAll(() => {
      revokePresignUrlMock.mockRestore()
      // initWithNewCredsMock.mockRestore()
    })

    test('call revoke', async () => {
      const res = await files.revokeAllPresignURLs()
      expect(initWithNewCredsMock).toHaveBeenCalled()
      expect(revokePresignUrlMock).toHaveBeenCalled()
      expect(res).toEqual(fakeRes)
    })
  })
})

describe('exists', () => {
  test('missing _fileExists implementation', async () => {
    const files = new Files()
    await global.expectToThrowNotImplemented(files._fileExists.bind('path'), '_fileExists')
  })
})
