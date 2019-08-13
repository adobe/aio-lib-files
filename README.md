# Adobe I/O CNA Storage SDK

An abstraction on top of blob cloud storage exposing a file like API.
To use this SDK you can either provide your I/O Runtime or credentials from
supported cloud providers.

## Storage SDK

### Usage

```js
  const storageSDK = require('@adobe/io-cna-storage')

  const storage = await storageSDK.init({ ow: { namespace, auth } })

  await storage.write('mydir/myfile.txt', 'some private content')

  await storage.write('public/index.html', '<h1>Hello World!</h1>')

  await storage.list('/') // ['mydir/myfile.txt', 'public/index.html']
```

### APIs

- **Storage**:
see [JSDoc](doc/api.md)

## Contributing

Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

## Licensing

This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
