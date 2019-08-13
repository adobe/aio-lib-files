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

[![Version](https://img.shields.io/npm/v/@adobe/adobeio-cna-cloud-storage.svg)](https://npmjs.org/package/@adobe/adobeio-cna-cloud-storage)
[![Downloads/week](https://img.shields.io/npm/dw/@adobe/adobeio-cna-cloud-storage.svg)](https://npmjs.org/package/@adobe/adobeio-cna-cloud-storage)
[![Build Status](https://travis-ci.org/adobe/adobeio-cna-cloud-storage.svg?branch=master)](https://travis-ci.org/adobe/adobeio-cna-cloud-storage)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/adobeio-cna-cloud-storage/master.svg?style=flat-square)](https://codecov.io/gh/adobe/adobeio-cna-cloud-storage/)

# Adobe I/O CNA Storage SDK

An abstraction on top of cloud blob storage exposing a file like API.

You can initialize the SDK with your Adobe I/O Runtime (a.k.a OpenWhisk)
credentials.

Alternatively, you can bring your own cloud storage keys. Note however, that as
of now we only support Azure Blob Storage. AWS S3 is the next on the todo list
and will soon be available.

## Storage SDK

### Install

```bash
npm install @adobe/adobeio-cna-cloud-storage
```

### Usage example

```js
  const storageSDK = require('@adobe/adobeio-cna-cloud-storage')

  // init sdk using OpenWhisk credentials
  const storage = await storageSDK.init({ ow: { namespace, auth } })

  // write private file
  await storage.write('mydir/myfile.txt', 'some private content')

  // write publicly accessible file
  await storage.write('public/index.html', '<h1>Hello World!</h1>')

  // get file url
  const props = await storage.getProperties('public/index.html')
  props.url

  // list all files
  await storage.list('/') // ['mydir/myfile.txt', 'public/index.html']

  // read
  const buffer = await storage.read('mydir/myfile.txt')
  buffer.toString() // 'some private content'

  // pipe read stream to local file
  const rdStream = await storage.createReadStream('mydir/myfile.txt')
  const stream = rdStream.pipe(fs.createWriteStream('my-local-file.txt'))
  stream.on('finish', () => console.log('done!'))

  // write read stream to remote file
  const rdStream = fs.createReadStream('my-local-file.txt')
  await storage.write('my/remote/file.txt', rdStream)

  // delete files in 'my/remote/' dir
  await storage.delete('my/remote/')
  // delete all public files
  await storage.delete('public/')
  // delete all files including public
  await storage.delete('/')

  // copy
  // upload local directory
  await storage.copy('my-static-app/', 'public/', { localSrc: true })
  // download to local directory
  await storage.copy('public/my-static-app/', 'my-static-app-copy', { localDest: true })
  // copy files around cloud storage
  await storage.copy('public/my-static-app/', 'my/private/folder')
```

### API

`goto` [API](doc/api.md)

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
