## Modules

<dl>
<dt><a href="#module_types">types</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#Files">Files</a></dt>
<dd><p>Cloud Files Abstraction</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#init">init([config])</a> ⇒ <code><a href="#Files">Promise.&lt;Files&gt;</a></code></dt>
<dd><p>Initializes and returns the cloud files SDK.</p>
<p>To use the SDK you must either provide provide your
<a href="#module_types..OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>credentials.ow</code> or your own
<a href="#module_types..AzureCredentialsAccount">Azure blob storage credentials</a> in <code>credentials.azure</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables (<code>__OW_NAMESPACE</code> and <code>__OW_AUTH</code>).</p>
</dd>
</dl>

<a name="module_types"></a>

## types

* [types](#module_types)
    * [~OpenWhiskCredentials](#module_types..OpenWhiskCredentials) : <code>object</code>
    * [~AzureCredentialsSAS](#module_types..AzureCredentialsSAS) : <code>object</code>
    * [~AzureCredentialsAccount](#module_types..AzureCredentialsAccount) : <code>object</code>
    * [~RemotePathString](#module_types..RemotePathString) : <code>string</code>
    * [~RemoteFileProperties](#module_types..RemoteFileProperties) : <code>object</code>
    * [~FilesLibErrors](#module_types..FilesLibErrors) : <code>object</code>

<a name="module_types..OpenWhiskCredentials"></a>

### types~OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | user namespace |
| auth | <code>string</code> | auth key |

<a name="module_types..AzureCredentialsSAS"></a>

### types~AzureCredentialsSAS : <code>object</code>
SAS Azure credentials. The sdk needs two SAS credentials to allow access to
two already existing containers, a private and a public one (with access=`blob`).

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| sasURLPrivate | <code>string</code> | sas url to existing private azure blob container |
| sasURLPublic | <code>string</code> | sas url to existing public (with access=`blob`) azure blob container |

<a name="module_types..AzureCredentialsAccount"></a>

### types~AzureCredentialsAccount : <code>object</code>
Azure account credentials. Must have the permission to create containers.

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| storageAccount | <code>string</code> | name of azure storage account |
| storageAccessKey | <code>string</code> | access key for azure storage account |
| containerName | <code>string</code> | name of container to store files. Another `${containerName}-public` will also be used for public files. |

<a name="module_types..RemotePathString"></a>

### types~RemotePathString : <code>string</code>
a string to the remote path. If the path ends with a `/` it will
be treated as a directory, if not it will be treated as a file.

**Kind**: inner typedef of [<code>types</code>](#module_types)  
<a name="module_types..RemoteFileProperties"></a>

### types~RemoteFileProperties : <code>object</code>
**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| isDirectory | <code>boolean</code> | true if file is a path |
| isPublic | <code>boolean</code> | true if file is public |
| url | <code>string</code> | remote file url |

<a name="module_types..FilesLibErrors"></a>

### types~FilesLibErrors : <code>object</code>
Files lib custom errors.

`e.sdkDetails` provides additional context for each error (e.g. function parameter)

**Kind**: inner typedef of [<code>types</code>](#module_types)  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ERROR_BAD_ARGUMENT | <code>FilesLibError</code> | this error is thrown when an argument is missing or has invalid type |
| ERROR_NOT_IMPLEMENTED | <code>FilesLibError</code> | this error is thrown when a method is not implemented or when calling methods directly on the abstract class (Files). |
| ERROR_BAD_CREDENTIALS | <code>FilesLibError</code> | this error is thrown when the supplied init credentials are invalid. |
| ERROR_INTERNAL | <code>FilesLibError</code> | this error is thrown when an unknown error is thrown by the underlying provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`. |
| ERROR_FILE_NOT_EXISTS | <code>FilesLibError</code> | this error is thrown when the filePath does not exists for operations that need the file to exists (e.g. read) |
| ERROR_BAD_FILE_TYPE | <code>FilesLibError</code> | this error is thrown when the filePath is not the expected type for operations that need the file to be of a specific type, e.g. write on a dir would fail |

<a name="Files"></a>

## *Files*
Cloud Files Abstraction

**Kind**: global abstract class  

* *[Files](#Files)*
    * *[.list([filePath])](#Files+list) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * *[.delete(filePath, [options])](#Files+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * *[.createReadStream(filePath, [options])](#Files+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
    * *[.createWriteStream(filePath)](#Files+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
    * *[.read(filePath, [options])](#Files+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
    * *[.write(filePath, content)](#Files+write) ⇒ <code>Promise.&lt;number&gt;</code>*
    * *[.getProperties(filePath)](#Files+getProperties) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties)*
    * *[.copy(srcPath, destPath, [options])](#Files+copy) ⇒ <code>Promise.&lt;object.&lt;string, string&gt;&gt;</code>*

<a name="Files+list"></a>

### *files.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Lists files in a remote folder. If called on a file returns only this file path.
This is comparable to bash's `ls` command

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) if not specified list all files |

<a name="Files+delete"></a>

### *files.delete(filePath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Deletes a remote file or directory

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of deleted paths  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteDeleteOptions |
| [options.progressCallback] | <code>function</code> |  | cb(RemoteFile) is called after  the operation completed on each file |

<a name="Files+createReadStream"></a>

### *files.createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
***NodeJS only (streams). Does not work on directories.***

Creates a read stream

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Files+createWriteStream"></a>

### *files.createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
**[UNSTABLE] please prefer using `write(<NodeJS.ReadableStream>)`**

***NodeJS only (streams). Does not work on directories.***

Returns a write stream.
Use `stream.on('finish', (bytesWritten) => {})` to listen on completion event

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |

<a name="Files+read"></a>

### *files.read(filePath, [options]) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
***Does not work on directories.***

Reads a remote file content

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer holding content  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteReadOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Files+write"></a>

### *files.write(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
***Does not work on directories.***

Writes content to a file

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |
| content | <code>string</code> \| <code>Buffer</code> \| <code>NodeJS.ReadableStream</code> | to be written, `ReadableStream` input works for **NodeJS only** |

<a name="Files+getProperties"></a>

### *files.getProperties(filePath) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties)*
Reads properties of a file or directory

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties) - resolves [RemoteFileProperties](#module_types..RemoteFileProperties)  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |

<a name="Files+copy"></a>

### *files.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;object.&lt;string, string&gt;&gt;</code>*
***NodeJS only (streams).***

A utility function to copy files and directories across remote and local Files.
This is comparable to the `scp` command

Rules for copy files are:
 1. Remote => Remote
   - a/ (dir) => b/: b/a/
   - a (file) => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
   - a (file) => b : b    *does nothing if b exists and noOverwrite=true*
   - a/ (dir) => b : b/   *always allowed: in remote Files we can have both b and b/*
 2. Remote => Local
   - a/ => b/: b/a/
   - a  => b/: b/a *does nothing if b/a exists and noOverwrite=true*
   - a  => b : b   *does nothing if b exists and noOverwrite=true*
   - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
 3. Local => Remote
   - a/ => b/: b/a/
   - a  => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
   - a  => b : b    *does nothing if b exists and noOverwrite=true*
   - a/ => b: b/    *always allowed: in remote Files we can have both b and b/*
 4. Local => Local
   - not supported

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;object.&lt;string, string&gt;&gt;</code> - returns a promise resolving to an object containing all copied files
from src to dest `{ srcFilePath: destFilePath }`  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.noOverwrite] | <code>boolean</code> | <code>false</code> | set to true to overwrite existing files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file,the srcPath and destPath to the copied file are passed as argument to the callback `progressCallback(srcPath, destPath)` |

<a name="init"></a>

## init([config]) ⇒ [<code>Promise.&lt;Files&gt;</code>](#Files)
Initializes and returns the cloud files SDK.

To use the SDK you must either provide provide your
[OpenWhisk credentials](#module_types..OpenWhiskCredentials) in
`credentials.ow` or your own
[Azure blob storage credentials](#module_types..AzureCredentialsAccount) in `credentials.azure`.

OpenWhisk credentials can also be read from environment variables (`__OW_NAMESPACE` and `__OW_AUTH`).

**Kind**: global function  
**Returns**: [<code>Promise.&lt;Files&gt;</code>](#Files) - A Files instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [config] | <code>object</code> | <code>{}</code> | configuration used to init the sdk |
| [config.ow] | [<code>OpenWhiskCredentials</code>](#module_types..OpenWhiskCredentials) |  | [OpenWhiskCredentials](#module_types..OpenWhiskCredentials). Set those if you want to use ootb credentials to access the state management service. OpenWhisk namespace and auth can also be passed through environment variables: `__OW_NAMESPACE` and `__OW_AUTH` |
| [config.azure] | [<code>AzureCredentialsAccount</code>](#module_types..AzureCredentialsAccount) \| [<code>AzureCredentialsSAS</code>](#module_types..AzureCredentialsSAS) |  | bring your own [Azure SAS credentials](#module_types..AzureCredentialsSAS) or [Azure storage account credentials](#module_types..AzureCredentialsAccount) |
| [config.tvm] | <code>object</code> |  | tvm configuration, applies only when passing OpenWhisk credentials |
| [config.tvm.apiUrl] | <code>string</code> |  | alternative tvm api url. |
| [config.tvm.cacheFile] | <code>string</code> |  | alternative tvm cache file, set to `false` to disable caching of temporary credentials. |

