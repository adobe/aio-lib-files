const { Files } = require('../lib/Files')
const upath = require('upath')
const stream = require('stream')
const fs = require('fs-extra')

const ujoin = (...args) => upath.toUnix(upath.join(...args))
const ujoinFiles = (dirs, fakeFiles) => {
  if (!Array.isArray(dirs)) dirs = [dirs]
  return fakeFiles.map(f => ujoin(...dirs, f))
}
const fakeFile = 'fake/file.txt'

beforeEach(() => {
  expect.hasAssertions()
})

describe('init', () => {
  test('missing implementation', async () => {
    await expect(Files.init.bind(Files)).toThrowNotImplemented('init')
  })
})

describe('constructor', () => {
  test('missing implementation', async () => {
    await expect(() => new Files()).toThrowNotImplemented('Files')
  })
})

describe('list', () => {
  test('missing _fileExists implementation', async () => {
    const files = new Files(true)
    await expect(files.list.bind(files, fakeFile)).toThrowNotImplemented('_fileExists')
  })
  test('missing _listFolder implementation', async () => {
    const files = new Files(true)
    await expect(files.list.bind(files, '/')).toThrowNotImplemented('_listFolder')
  })

  describe('_fileExists and _listFolder mock implementations', () => {
    const fileExistsMock = jest.spyOn(Files.prototype, '_fileExists')
    const listFolderMock = jest.spyOn(Files.prototype, '_listFolder')

    const fakeFiles = (dir) => ujoinFiles(dir, ['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'])
    let files
    beforeEach(() => {
      files = new Files(true)
      fileExistsMock.mockReset()
      listFolderMock.mockReset()
      // defaults that work
      listFolderMock.mockImplementation(async (...args) => fakeFiles(...args))
    })
    afterAll(() => {
      fileExistsMock.mockRestore()
      listFolderMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await expect(files.list.bind(files, 123)).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when path is an existing file with a non normalized path', async () => {
      fileExistsMock.mockResolvedValue(true)
      const res = await files.list('hello/../afile.txt')
      expect(res).toEqual(['afile.txt'])
      expect(fileExistsMock).toHaveBeenCalledWith('afile.txt')
      expect(listFolderMock).toHaveBeenCalledTimes(0)
    })
    test('when path is a non existing file', async () => {
      fileExistsMock.mockResolvedValue(false)
      const res = await files.list('afile.txt')
      expect(res).toEqual([])
      expect(fileExistsMock).toHaveBeenCalledTimes(1)
      expect(listFolderMock).toHaveBeenCalledTimes(0)
    })
    const testRootFolder = async (dir) => {
      const res = await files.list(dir)
      expect(res).toEqual(fakeFiles(''))
      expect(fileExistsMock).toHaveBeenCalledTimes(0)
      expect(listFolderMock).toHaveBeenCalledTimes(1)
    }
    test('when path is undefined (root folder)', async () => testRootFolder())
    test('when path is / (root folder)', async () => testRootFolder('/'))
    test(`when path is '' (root folder)`, async () => testRootFolder(''))
    test(`when path is '.' (root folder)`, async () => testRootFolder('.'))
    test('when path is a non normalized directory', async () => {
      const res = await files.list('hello/../hi/')
      expect(res).toEqual(fakeFiles('hi/'))
      expect(fileExistsMock).toHaveBeenCalledTimes(0)
      expect(listFolderMock).toHaveBeenCalledWith('hi/')
    })
    test('when path is an empty directory', async () => {
      listFolderMock.mockResolvedValue([])
      const res = await files.list('hello/../hi/')
      expect(res).toEqual([])
    })
  })
})

describe('delete', () => {
  test('missing _deleteFile implementation', async () => {
    const files = new Files(true)
    files.list = jest.fn().mockResolvedValue([fakeFile])
    await expect(files.delete.bind(files, fakeFile)).toThrowNotImplemented('_deleteFile')
  })
  describe('list and _deleteFile mock implementations', () => {
    const listMock = jest.spyOn(Files.prototype, 'list')
    const deleteFileMock = jest.spyOn(Files.prototype, '_deleteFile')

    let files
    beforeEach(() => {
      files = new Files(true)
      listMock.mockReset()
      deleteFileMock.mockReset()

      deleteFileMock.mockImplementation(f => Promise.resolve(f))
    })
    afterAll(() => {
      deleteFileMock.mockRestore()
      listMock.mockRestore()
    })

    test('when path is not a valid string', async () => {
      await expect(files.delete.bind(files, 123)).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when progressCallback is not a valid function', async () => {
      await expect(files.delete.bind(files, 'afile', { progressCallback: 'astring' })).toThrowBadArgWithMessageContaining(['progressCallback', 'function'])
    })
    test('with a bad option', async () => {
      await expect(files.delete.bind(files, fakeFile, { some__wrong__option: 'astring' })).toThrowBadArgWithMessageContaining(['some__wrong__option'])
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
    }
    test('delete a single file without progress callback', async () => testDelete(['a/b/c/d.txt'], false))
    test('delete multiple files without progress callback', async () => testDelete(['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'], false))
    test('delete a single file with progress callback', async () => testDelete(['a/b/c/d.txt'], true))
    test('delete multiple files with progress callback', async () => testDelete(['a/b/c/d.txt', 'e.jpg', 'f/g/h.html'], true))
  })
})

describe('createReadStream', () => {
  test('missing _createReadStream implementation', async () => {
    const files = new Files(true)
    await expect(files.createReadStream.bind(files, fakeFile)).toThrowNotImplemented('_createReadStream')
  })

  describe('_createReadStream mock implementations', () => {
    const createReadStreamMock = jest.spyOn(Files.prototype, '_createReadStream')
    let fakeRdStream
    let files
    beforeEach(() => {
      files = new Files(true)
      fakeRdStream = new stream.Readable()
      fakeRdStream.push(null)
      createReadStreamMock.mockReset()
      createReadStreamMock.mockResolvedValue(fakeRdStream)
    })
    afterAll(() => {
      createReadStreamMock.mockRestore()
    })
    test('when path is not a valid string', async () => {
      await expect(files.createReadStream.bind(files, 123)).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when path is undefined', async () => {
      await expect(files.createReadStream.bind(files, undefined)).toThrowBadArgWithMessageContaining(['filePath', 'required'])
    })
    test('when path is a dir (not allowed)', async () => {
      await expect(files.createReadStream.bind(files, 'a/dir/')).toThrowBadArgDirectory('a/dir/')
    })
    test('when options.position is not a number', async () => {
      await expect(files.createReadStream.bind(files, fakeFile, { position: 'astring' })).toThrowBadArgWithMessageContaining(['position', 'number'])
    })
    test('when options.length is not a number', async () => {
      await expect(files.createReadStream.bind(files, fakeFile, { length: 'astring' })).toThrowBadArgWithMessageContaining(['length', 'number'])
    })
    test('with a bad option', async () => {
      await expect(files.createReadStream.bind(files, fakeFile, { some__wrong__option: 'astring' })).toThrowBadArgWithMessageContaining(['some__wrong__option'])
    })
    const testCreateReadStream = async (options) => {
      const res = await files.createReadStream('hello/../file', options) // test with non normalized path
      expect(res).toEqual(fakeRdStream)
      expect(createReadStreamMock).toHaveBeenCalledWith('file', options || {})
    }
    test('when options are undefined and path is non normalized', async () => testCreateReadStream())
    test('when options.position is a number', async () => testCreateReadStream({ position: 1 }))
    test('when options.length is a number', async () => testCreateReadStream({ length: 10 }))
    test('when options.length and options.positions are numbers', async () => testCreateReadStream({ position: 1, length: 10 }))
  })
})

describe('createWriteStream', () => {
  test('missing _createWriteStream implementation', async () => {
    const files = new Files(true)
    await expect(files.createWriteStream.bind(files, fakeFile)).toThrowNotImplemented('_createWriteStream')
  })
  describe('_createWriteStream mock implementations', () => {
    const createWriteStreamMock = jest.spyOn(Files.prototype, '_createWriteStream')
    let files
    let fakeWriteStream = new stream.Writable()
    beforeEach(() => {
      files = new Files(true)
      createWriteStreamMock.mockReset()
      createWriteStreamMock.mockResolvedValue(fakeWriteStream)
    })
    afterAll(() => {
      createWriteStreamMock.mockRestore()
    })
    test('when path is not a valid string', async () => {
      await expect(files.createWriteStream.bind(files, 123)).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when path is undefined', async () => {
      await expect(files.createWriteStream.bind(files, undefined)).toThrowBadArgWithMessageContaining(['filePath', 'required'])
    })
    test('when path is a dir (not allowed)', async () => {
      await expect(files.createWriteStream.bind(files, 'a/dir/')).toThrowBadArgDirectory('a/dir/')
    })

    test('when file is a non normalized path', async () => {
      const res = await files.createWriteStream('hello/../file')
      expect(res).toEqual(fakeWriteStream)
      expect(createWriteStreamMock).toHaveBeenCalledWith('file')
    })
  })
})

describe('read', () => {
  test('missing _createReadStream implementation', async () => {
    const files = new Files(true)
    await expect(files.read.bind(files, fakeFile)).toThrowNotImplemented('createReadStream')
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
      files = new Files(true)
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
    const files = new Files(true)
    await expect(files.write.bind(files, fakeFile, 'content')).toThrowNotImplemented('_writeBuffer')
  })
  test('missing _writeStream implementation', async () => {
    const files = new Files(true)
    await expect(files.write.bind(files, fakeFile, global.createStream('hello'))).toThrowNotImplemented('_writeStream')
  })

  describe('_writeBuffer and _writeStream mock implementations', () => {
    const writeBufferMock = jest.spyOn(Files.prototype, '_writeBuffer')
    const writeStreamMock = jest.spyOn(Files.prototype, '_writeStream')
    let files
    beforeEach(() => {
      files = new Files(true)
      writeBufferMock.mockReset()
      writeStreamMock.mockReset()
    })
    afterAll(() => {
      writeBufferMock.mockRestore()
      writeStreamMock.mockRestore()
    })
    test('when path is not a valid string', async () => {
      await expect(files.write.bind(files, 123, 'content')).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when path undefined', async () => {
      await expect(files.write.bind(files, undefined, 'content')).toThrowBadArgWithMessageContaining(['filePath', 'required'])
    })
    test('when content is undefined', async () => {
      await expect(files.write.bind(files, fakeFile)).toThrowBadArgWithMessageContaining(['content', 'required'])
    })
    test('when path is a dir (not allowed)', async () => {
      await expect(files.write.bind(files, 'a/dir/', 'content')).toThrowBadArgDirectory('a/dir/')
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
      } else {
        expect(writeBufferMock).toHaveBeenCalledWith('file', content)
      }
    }
    test('when file is a non normalized path and content is a string', async () => testWrite('hello'))
    test('when content is a buffer', async () => testWrite(Buffer.from('hello')))
    test('when content is a readable stream', async () => testWrite(new stream.Readable()))
  })
})

describe('getProperties', () => {
  test('missing _getUrl implementation', async () => {
    const files = new Files(true)
    await expect(files.getProperties.bind(files, fakeFile)).toThrowNotImplemented('_getUrl')
  })
  describe('_getUrl mock implementation', () => {
    const getUrlMock = jest.spyOn(Files.prototype, '_getUrl')
    let files
    const fakeUrl = 'http://fake.com'
    beforeEach(() => {
      files = new Files(true)
      getUrlMock.mockReset()
      getUrlMock.mockReturnValue(fakeUrl)
    })
    afterAll(() => {
      getUrlMock.mockRestore()
    })
    test('when path is not a valid string', async () => {
      await expect(files.getProperties.bind(files, 123)).toThrowBadArgWithMessageContaining(['filePath', 'string'])
    })
    test('when path undefined', async () => {
      await expect(files.getProperties.bind(files, undefined)).toThrowBadArgWithMessageContaining(['filePath', 'required'])
    })
    test('when filePath is non normalized', async () => {
      await files.getProperties('hello/../file')
      expect(getUrlMock).toHaveBeenCalledWith('file')
    })
    test('when filePath is a private file', async () => {
      const res = await files.getProperties('a/private/file')
      expect(res).toEqual({
        isDirectory: false,
        isPublic: false,
        url: fakeUrl
      })
    })
    test('when filePath is a public file', async () => {
      const res = await files.getProperties('public/file')
      expect(res).toEqual({
        isDirectory: false,
        isPublic: true,
        url: fakeUrl
      })
    })
    test('when filePath is a public dir', async () => {
      const res = await files.getProperties('public/dir/')
      expect(res).toEqual({
        isDirectory: true,
        isPublic: true,
        url: fakeUrl
      })
    })
    test('when filePath is a private dir', async () => {
      const res = await files.getProperties('a/private/dir/')
      expect(res).toEqual({
        isDirectory: true,
        isPublic: false,
        url: fakeUrl
      })
    })
    test('when filePath is public root (public)', async () => {
      const res = await files.getProperties('public')
      expect(res).toEqual({
        isDirectory: true,
        isPublic: true,
        url: fakeUrl
      })
    })
    test('when filePath is root ("" or /)', async () => {
      const expectedRes = {
        isDirectory: true,
        isPublic: false,
        url: fakeUrl
      }
      let res = await files.getProperties('')
      expect(res).toEqual(expectedRes)
      res = await files.getProperties('/')
      expect(res).toEqual(expectedRes)
    })
  })
})

test('missing _statusFromProviderError implementation', async () => {
  const files = new Files(true)
  await expect(files._statusFromProviderError.bind(files, 'error')).toThrowNotImplemented('_statusFromProviderError')
})

describe('copy', () => {
  test('missing _copyRemoteToRemoteFile (for remote/remote case)', async () => {
    const fakeFile2 = 'fake/file2.txt'
    const files = new Files(true)
    files.list = jest.fn().mockImplementation(f => { if (f === fakeFile) return [fakeFile]; else return [] })
    await expect(files.copy.bind(files, fakeFile, fakeFile2)).toThrowNotImplemented('_copyRemoteToRemoteFile')
  })

  describe('bad input', () => {
    let files
    beforeEach(() => {
      files = new Files(true)
    })
    test('when srcPath is not a valid string', async () => {
      await expect(files.copy.bind(files, 123, 'dest')).toThrowBadArgWithMessageContaining(['srcPath', 'string'])
    })
    test('when destPath is not a valid string', async () => {
      await expect(files.copy.bind(files, 'src', 123)).toThrowBadArgWithMessageContaining(['destPath', 'string'])
    })
    test('when srcPath undefined', async () => {
      await expect(files.copy.bind(files, undefined, 'dest')).toThrowBadArgWithMessageContaining(['srcPath', 'required'])
    })
    test('when destPath undefined', async () => {
      await expect(files.copy.bind(files, 'src', undefined)).toThrowBadArgWithMessageContaining(['destPath', 'required'])
    })
    test('when options.noOverwrite is not a boolean', async () => {
      await expect(files.copy.bind(files, 'src', 'dest', { noOverwrite: 1234 })).toThrowBadArgWithMessageContaining(['noOverwrite', 'boolean'])
    })
    test('when options.localSrc is not a boolean', async () => {
      await expect(files.copy.bind(files, 'src', 'dest', { localSrc: 1234 })).toThrowBadArgWithMessageContaining(['localSrc', 'boolean'])
    })
    test('when options.localDest is not a boolean', async () => {
      await expect(files.copy.bind(files, 'src', 'dest', { localDest: 1234 })).toThrowBadArgWithMessageContaining(['localDest', 'boolean'])
    })
    test('when options.progressCallback is not a function', async () => {
      await expect(files.copy.bind(files, 'src', 'dest', { progressCallback: 1234 })).toThrowBadArgWithMessageContaining(['progressCallback', 'function'])
    })
    test('when both options.localSrc and options.localDest are specified', async () => {
      await expect(files.copy.bind(files, 'src', 'dest', { localDest: true, localSrc: true })).toThrowBadArgWithMessageContaining(['localDest', 'localSrc'])
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
      files = new Files(true)
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
      if (options.localDest) expected = Object.keys(expected).reduce((obj, k) => { obj[k] = uResolve(expected[k]); return obj }, {})
      if (options.localSrc) expected = Object.keys(expected).reduce((obj, k) => { obj[uResolve(k)] = expected[k]; return obj }, {})

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
    }
    const allGenericCopyTests = (localSrc = undefined, localDest = undefined) => {
      const localOptions = { localSrc, localDest }
      /* ** src does not exist ** */
      test('when src does not exist', async () => {
        addFiles([], { local: localSrc })
        await expect(files.copy.bind(files, fakeSrcFile, fakeDestFile, localOptions)).toThrowFileNotExists(fakeSrcFile)
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
        await testCopyOk(fakeSrcFile, fakeDestFile, { ...localOptions, noOverwrite: true, progressCallback: jest.fn() }, { })
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
        await testCopyOk('a', fakeDestDir, localOptions, { 'a': ujoin(fakeDestDir, 'a') })
      })
      test('when src is a file and dest is an existing dir containing a different file and noOverwrite and progressCallback', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true, progressCallback: jest.fn() }, { 'a': ujoin(fakeDestDir, 'a') })
      })
      test('when src is a file and dest is an existing dir with same name as file', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b'], { local: localDest, prefix: 'a' })
        await testCopyOk('a', 'a/', localOptions, { 'a': 'a/a' })
      })
      test('when src is a file and dest is an existing dir which contain the same file name', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, localOptions, { 'a': ujoin(fakeDestDir, 'a') })
      })
      test('when src is a file and dest is an existing dir which contain the same file name and noOverwrite = true', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true }, {})
      })
      test('when src is a file and dest has a subdir with the same file name and noOverwrite = true', async () => {
        addFiles(['a'], { local: localSrc })
        addFiles(['b/a'], { local: localDest, prefix: fakeDestDir })
        await testCopyOk('a', fakeDestDir, { ...localOptions, noOverwrite: true }, { 'a': ujoin(fakeDestDir, 'a') })
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
          await expect(files.copy.bind(files, fakeSrcDir, fakeDestFile, options)).toThrowBadFileType(fakeDestFile)
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
        await expect(files.copy.bind(files, fakeSrcFile, fakeDestFile, { localSrc: true })).toThrowBadFileType(fakeSrcFile)
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
          expect(e).toEqual(fakeError)
        }
      })
    })
    describe('remote -> local', () => {
      allGenericCopyTests(undefined, true)
      test('local dest is symlink', async () => {
        addFiles([fakeSrcFile], { local: false })
        addFiles([fakeDestFile], { local: true, isSymlink: true })
        await expect(files.copy.bind(files, fakeSrcFile, fakeDestFile, { localDest: true })).toThrowBadFileType(fakeDestFile)
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
          expect(e).toEqual(fakeError)
        }
      })
    })
  })
})
