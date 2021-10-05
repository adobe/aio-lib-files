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
![Node.js CI](https://github.com/adobe/aio-lib-files/workflows/Node.js%20CI/badge.svg)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Codecov Coverage](https://img.shields.io/codecov/c/github/adobe/aio-lib-files/master.svg?style=flat-square)](https://codecov.io/gh/adobe/aio-lib-files/)

# Adobe I/O Lib Files

A Node JavaScript abstraction on top of cloud blob storages exposing a file-system like API.

You can initialize the SDK with your Adobe I/O Runtime (a.k.a OpenWhisk)
credentials.

Alternatively, you can bring your own cloud storage keys. Note however, that as
of now we only support Azure Blob Storage.

Please note that currently you must be a customer of [Adobe Developer App Builder](https://www.adobe.io/apis/experienceplatform/project-firefly.html) to use this library. App Builder is a complete framework that enables enterprise developers to build and deploy custom web applications that extend Adobe Experience Cloud solutions and run on Adobe infrastructure.

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
  // init when env vars __OW_API_KEY and __OW_NAMESPACE are set (e.g. when running in an OpenWhisk action)
  const files = await filesLib.init()
  // or if you want to use your own cloud storage account
  const files = await filesLib.init({ azure: { storageAccount, storageAccessKey, containerName } })

  // write private file
  await files.write('mydir/myfile.txt', 'some private content')

  // write publicly accessible file
  await files.write('public/index.html', '<h1>Hello World!</h1>')

   // get file url
  const props = await files.getProperties('public/index.html')
  console.log('props = ', props)
  /*
  props =  { name: 'public/index.html',
    creationTime: 2020-12-09T19:49:58.000Z,
    lastModified: 2020-12-09T19:49:58.000Z,
    etag: '"0x8D89C7B9BB75A6F"',
    contentLength: 21,
    contentType: 'text/html',
    isDirectory: false,
    isPublic: true,
    url:
    'https://jestaiotest.blob.core.windows.net/readme-public/public%2Findex.html' }
  */

  // list all files
  await files.list('/') // ['mydir/myfile.txt', 'public/index.html']
  /*
  list =  [ { name: 'mydir/myfile.txt',
    creationTime: 2020-12-09T19:49:57.000Z,
    lastModified: 2020-12-09T19:49:57.000Z,
    etag: '0x8D89C7B9BB165F8',
    contentLength: 20,
    contentType: 'text/plain',
    isDirectory: false,
    isPublic: false,
    url:
     'https://jestaiotest.blob.core.windows.net/readme/mydir%2Fmyfile.txt' },
  { name: 'public/index.html',
    creationTime: 2020-12-09T19:49:58.000Z,
    lastModified: 2020-12-09T19:49:58.000Z,
    etag: '0x8D89C7B9BB75A6F',
    contentLength: 21,
    contentType: 'text/html',
    isDirectory: false,
    isPublic: true,
    url:
     'https://jestaiotest.blob.core.windows.net/readme-public/public%2Findex.html' } ]
  */

  // read
  const buffer = await files.read('mydir/myfile.txt')
  buffer.toString() // 'some private content'

  // pipe read stream to local file (consider using copy below)
  const rdStream = await files.createReadStream('mydir/myfile.txt')
  const stream = rdStream.pipe(fs.createWriteStream('my-local-file.txt'))
  stream.on('finish', () => console.log('done!'))

  // write read stream to remote file (consider using copy below)
  const rdStream = fs.createReadStream('my-local-file.txt')
  await files.write('my/remote/file.txt', rdStream)

  // delete files in 'my/remote/' dir
  await files.delete('my/remote/')
  // delete all public files
  await files.delete('public/')
  // delete all files including public
  await files.delete('/')

  // copy - higher level utility (works likes scp)
  // works for files and directories both remotely and locally, uses streams under the hood
  /// upload a single file
  await files.copy('my-static-app/index.html', 'public/my-static-app/index.html', { localSrc: true })
  /// upload local directory recursively
  await files.copy('my-static-app/', 'public/', { localSrc: true })
  /// download to local directory recursively (works for files as well)
  await files.copy('public/my-static-app/', 'my-static-app-copy', { localDest: true })
  /// copy remote directories around (works for files as well)
  await files.copy('public/my-static-app/', 'my/private/folder')

  // Share private files
  const presignUrl = await files.generatePresignURL('mydir/myfile.txt', { expiryInSeconds: 60 })

  //Share private files with read, write, delete permissions
  const rwdPresignUrl = await files.generatePresignURL('mydir/myfile.txt', { expiryInSeconds: 60, permissions: 'rwd' })
```

## Presigned URL types and usage
File SDK supports two types of presigned URLs to access a file
1) External - CDN based URLs which can be accessed from anywhere, assuming right pre-sign permissions for private files. You can use this type of URLs to provide access to your files to external systems and APIs for remote compute use-cases.
2) Internal - Direct URLs to file storage. These URLs work only if used within Adobe I/O Runtime actions. You can use this type of URLs to chain worker actions that are processing the same file from different Runtime namespaces. As there is no CDN indirection, using this type of URL will improve the performance of your Runtime actions.

[Files.getProperties](doc/api.md#Files+getProperties) returns both URL types (external as url, and internal as internalUrl) for a given file path
[Files.generatePresignURL](doc/api.md#Files+generatePresignURL) supports UrlType as option to generate presign URL of given type

See usage example below -

```js
  const  { init, UrlType }  = require('@adobe/aio-lib-files')
  const files = await init()

  // getProperties will return both internal and external URLs in return Object
  const props = files.getProperties('public/my-static-app/index.html')

  //generate presign URL with internal URLType
  const internalPresignUrl = await files.generatePresignURL('mydir/myfile.txt', { expiryInSeconds: 60, permissions: 'rwd', urltype: UrlType.internal })

```

## Explore

`goto` [API](doc/api.md)

## Debug

set `DEBUG=@adobe/aio-lib-files*` to see debug logs.


## Adobe I/O Files Store Consistency Guarantees

**Strong consistency** is guaranteed for all operations and across instances of the files sdk (returned by `filesLib.init()`).

## Troubleshooting

### `"[StateLib:ERROR_INTERNAL] unknown error response from provider with status: unknown"`
- when using `@adobe/aio-lib-files` in an action bundled with **webpack** please make sure to turn off minification and enable resolving of es6 modules. Add the following lines to your webpack config:
```javascript
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: ['.js'],
    mainFields: ['main']
  }
```

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
