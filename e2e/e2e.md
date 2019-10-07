# Adobe I/O Lib Files E2E tests

## Requirements

- To run the test you'll need two OpenWhisk namespaces. Please set the credentials for those in the following env
  variables:
  - `TEST_NAMESPACE_1, TEST_AUTH_1, TEST_NAMESPACE_2, TEST_AUTH_2`

## Run

`npm run e2e`

## Test overview

Before each test a file storage instance is initialized using OpenWhisk credentials and all files associated to the
namespace are deleted.

Here is an overview of what is tested in [e2e.js](./e2e.js):

- bad OpenWhisk credentials:
  - `expect to throw ERROR_BAD_CREDENTIALS`
- read write delete test:
  - test reading a non existing file
    - read the file
    - `expect to throw ERROR_FILE_NOT_EXISTS`
  - test writing a string to a file
    - write to a file
    - read the file
    - `expect content to match`
  - test file deletion
    - delete the file
    - read the file
    - `expect to throw ERROR_FILE_NOT_EXISTS`
- read positional options test
  - test reading a substring
    - write some test content
    - read the content from a given position for a given length
    - `expect the returned content to match the expected substring`
  - read with length > than total file content size
    - `expect returned value to be the full content`
  - read with position > than total file content size
    - `expect to throw ERROR_OUT_OF_RANGE`
- private access test
  - make sure that private files are not accessible w/o credentials
    - write a private file
    - getProperties.url
    - fetch the url using node-fetch
    - `expect response with bad status`
- public access test
  - make sure that public files are accessible w/o credentials
    - write a public file
    - getProperties.url
    - fetch the url using node-fetch
    - `expect response body to match written content`
- list tests
  - test the list operation on various sub-folders, public and private folders and files
    - write multiple files to different sub-folders
    - expect that list(path) returns the expected files for the following paths:
      - `/`, `public`, `public/<dir>/`, `public/<sub>/<dir>/`, `<dir>`, `<sub>/<dir>/`, `file`, `<sub>/<dir>` (w/o
        trailing /)
- stream test
  - test that streams can be written to a file and created from a file
    - write a file using a test stream
    - `expect write to return with the stream content length`
    - create a read stream from the previously written file
    - read the stream
    - `expect the read content to be equal to the written content`
- isolation test (uses 2 namespaces: ns1, ns2)
  - test that ns2 cannot read a file in ns1
    - write a file in ns1
    - read same file name in ns2
    - `expect to throw ERROR_FILE_NOT_EXISTS`
  - test that ns2 cannot update a file in ns1
    - write to the same filename in ns2 with another content string
    - read file in ns1
    - `expect same content as written in ns1`
  - test that ns1 cannot delete a file in ns2
    - delete file in ns1
    - read file in ns2
    - `expect ns2 content`
- copy directory cycle local->remote->remote->local
  - prepare some local files in a folder with sub-directories
  - foreach of (local->remote, remote->remote and remote-local)
    - copy a src folder (with sub-directories) to destination
    - `expect copy to return a map of size # of copied files`
    - list files in destination storage
    - `expect to match file names from local folder`
- test noOverwrite option for file copy
  - prepare files to overwrite: 2 in remote folders and 1 in a local directory
  - foreach of (local->remote, remote->remote and remote-local)
    - copy a file with noOverwrite set to true
    - `expect copy to return a map of size 0`
    - read destination file
    - `expect content to be old content`
    - copy a file with noOverwrite set to false
    - `expect copy to return a map of size 1`
    - read destination file
    - `expect content to be new content`
