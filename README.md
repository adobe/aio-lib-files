<!--
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
-->

[![Version](https://img.shields.io/npm/v/@adobe/aio-lib-files.svg)](https://npmjs.org/package/@adobe/aio-lib-files)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/aio-lib-files.svg)](https://npmjs.org/package/@adobe/aio-lib-files)
[![Build Status](https://travis-ci.com/adobe/aio-lib-files.svg?branch=master)](https://travis-ci.com/adobe/aio-lib-files)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-lib-files/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-lib-files/)

# Adobe I/O Lib Files

A JavaScript abstraction on top of cloud blob storages exposing a file-system like API.

You can initialize the SDK with your Adobe I/O Runtime (a.k.a OpenWhisk)
credentials.

Alternatively, you can bring your own cloud storage keys. Note however, that as
of now we only support Azure Blob Storage. AWS S3 is the next on the todo list
and will soon be available.

## Install

```bash
npm install @adobe/aio-lib-files
```

## Use

```js
  const filesLib = require('@adobe/aio-lib-files')

  // init
  // init sdk using OpenWhisk credentials
  const files = await filesLib.init({ ow: { namespace, auth } })
  // init when env vars __OW_AUTH and __OW_NAMESPACE are set (e.g. when running in an OpenWhisk action)
  const files = await filesLib.init()
  // or if you want to use your own cloud storage account
  const files = await filesLib.init({ azure: { storageAccount, storageAccessKey, containerName } })

  // write private file
  await files.write('mydir/myfile.txt', 'some private content')

  // write publicly accessible file
  await files.write('public/index.html', '<h1>Hello World!</h1>')

  // get file url
  const props = await files.getProperties('public/index.html')
  props.url

  // list all files
  await files.list('/') // ['mydir/myfile.txt', 'public/index.html']

  // read
  const buffer = await files.read('mydir/myfile.txt')
  buffer.toString() // 'some private content'

  // pipe read stream to local file
  const rdStream = await files.createReadStream('mydir/myfile.txt')
  const stream = rdStream.pipe(fs.createWriteStream('my-local-file.txt'))
  stream.on('finish', () => console.log('done!'))

  // write read stream to remote file
  const rdStream = fs.createReadStream('my-local-file.txt')
  await files.write('my/remote/file.txt', rdStream)

  // delete files in 'my/remote/' dir
  await files.delete('my/remote/')
  // delete all public files
  await files.delete('public/')
  // delete all files including public
  await files.delete('/')

  // copy
  // upload local directory
  await files.copy('my-static-app/', 'public/', { localSrc: true })
  // download to local directory
  await files.copy('public/my-static-app/', 'my-static-app-copy', { localDest: true })
  // copy files around cloud files
  await files.copy('public/my-static-app/', 'my/private/folder')
```

## Explore

`goto` [API](doc/api.md)

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
