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
<a href="#OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>credentials.ow</code> or your own
<a href="#AzureCredentialsAccount">Azure blob storage credentials</a> in <code>credentials.azure</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables (<code>__OW_NAMESPACE</code> and <code>__OW_API_KEY</code>).</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#FilePermissions">FilePermissions</a> : <code>Object</code></dt>
<dd><p>Read, Write, Delete permission enum</p>
</dd>
<dt><a href="#UrlType">UrlType</a> : <code>Object</code></dt>
<dd><p>external, internal URL type enum</p>
</dd>
<dt><a href="#OpenWhiskCredentials">OpenWhiskCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the OpenWhisk credentials</p>
</dd>
<dt><a href="#AzureCredentialsSAS">AzureCredentialsSAS</a> : <code>object</code></dt>
<dd><p>SAS Azure credentials. The sdk needs two SAS credentials to allow access to
two already existing containers, a private and a public one (with access=<code>blob</code>).</p>
</dd>
<dt><a href="#AzureCredentialsAccount">AzureCredentialsAccount</a> : <code>object</code></dt>
<dd><p>Azure account credentials. Must have the permission to create containers.</p>
</dd>
<dt><a href="#RemotePathString">RemotePathString</a> : <code>string</code></dt>
<dd><p>a string to the remote path. If the path ends with a <code>/</code> it will
be treated as a directory, if not it will be treated as a file.</p>
</dd>
<dt><a href="#RemoteFileProperties">RemoteFileProperties</a> : <code>object</code></dt>
<dd><p>File properties</p>
</dd>
<dt><a href="#FilesLibError">FilesLibError</a> : <code>Error</code></dt>
<dd></dd>
<dt><a href="#FilesLibErrors">FilesLibErrors</a> : <code>object</code></dt>
<dd><p>Files lib custom errors.</p>
<p><code>e.sdkDetails</code> provides additional context for each error (e.g. function parameter)</p>
</dd>
</dl>

<a name="Files"></a>

## *Files*
Cloud Files Abstraction

**Kind**: global abstract class  

* *[Files](#Files)*
    * *[.list([filePath])](#Files+list) ⇒ <code>Promise.&lt;Array.&lt;RemoteFileProperties&gt;&gt;</code>*
    * *[.delete(filePath, [options])](#Files+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * *[.createReadStream(filePath, [options])](#Files+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
    * *[.createWriteStream(filePath)](#Files+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
    * *[.read(filePath, [options])](#Files+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
    * *[.write(filePath, content)](#Files+write) ⇒ <code>Promise.&lt;number&gt;</code>*
    * *[.getProperties(filePath)](#Files+getProperties) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties)*
    * *[.copy(srcPath, destPath, [options])](#Files+copy) ⇒ <code>Promise.&lt;{key: string}&gt;</code>*
    * *[.generatePresignURL(filePath, options)](#Files+generatePresignURL) ⇒ <code>Promise.&lt;string&gt;</code>*
    * *[.revokeAllPresignURLs()](#Files+revokeAllPresignURLs) ⇒ <code>void</code>*

<a name="Files+list"></a>

### *files.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;RemoteFileProperties&gt;&gt;</code>*
Lists files. Depending on the input the behavior is different:
- If a path has a trailing '/' it is considered as a folder and
  list returns files recursively contained below that path. If the
  directory is empty, an empty array is returned.
- If a path has no trailing '/' it will ALWAYS be considered a file and we
  will return the file (and its properties) in an array. If that file
  doesn't exist we return an empty array EVEN if listing a folder with the
  same name would return some files (folders are subpaths, not entities per se).

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;RemoteFileProperties&gt;&gt;</code> - resolves to array of
[RemoteFileProperties](#RemoteFileProperties)  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) Use a trailing '/' otherwise this is considered as a file. If not specified list all files. |

<a name="Files+delete"></a>

### *files.delete(filePath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Deletes a remote file or directory

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of deleted paths  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
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
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file. By default is set to 0. If set to bigger than size, throws an ERROR_OUT_OF_RANGE error |
| [options.length] | <code>number</code> |  | number of bytes to read. By default reads everything since starting position. If set to bigger than file size, reads until end. |

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
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+read"></a>

### *files.read(filePath, [options]) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
***Does not work on directories.***

Reads a remote file content

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer holding content  
**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteReadOptions |
| [options.position] | <code>number</code> |  | read start position of the file. By default is set to 0. If set to bigger than size, throws an ERROR_OUT_OF_RANGE error |
| [options.length] | <code>number</code> |  | number of bytes to read. By default reads everything since starting position. If set to bigger than file size, reads until end. |

<a name="Files+write"></a>

### *files.write(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
***Does not work on directories.***

Writes content to a file

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>string</code> \| <code>Buffer</code> \| <code>NodeJS.ReadableStream</code> | to be written, `ReadableStream` input works for **NodeJS only** |

<a name="Files+getProperties"></a>

### *files.getProperties(filePath) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties)*
Reads properties of a file or directory

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties) - resolves [RemoteFileProperties](#RemoteFileProperties)  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+copy"></a>

### *files.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;{key: string}&gt;</code>*
***NodeJS only (streams + fs).***

A utility function to copy files and directories across remote and local Files. This
is comparable to the `scp` command

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
   - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote
     dir to a local file*
 3. Local => Remote
   - a/ => b/: b/a/
   - a  => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
   - a  => b : b    *does nothing if b exists and noOverwrite=true*
   - a/ => b: b/    *always allowed: in remote Files we can have both b and b/*
 4. Local => Local
   - not supported

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;{key: string}&gt;</code> - returns a promise resolving to an object
containing all copied files from src to dest `{ srcFilePath: destFilePath }`  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#RemotePathString) |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#RemotePathString) |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.noOverwrite] | <code>boolean</code> | <code>false</code> | set to true to not overwrite existing dest files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file,the srcPath and destPath to the copied file are passed as argument to the callback `progressCallback(srcPath, destPath)` |

<a name="Files+generatePresignURL"></a>

### *files.generatePresignURL(filePath, options) ⇒ <code>Promise.&lt;string&gt;</code>*
Generate pre-sign URLs for a private file

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;string&gt;</code> - Presign URL for the given file  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| options | <code>object</code> | Options to generate presign URL |
| options.expiryInSeconds | <code>number</code> | presign URL expiry duration |
| options.permissions | <code>string</code> | permissions for presigned URL (any combination of rwd) |
| options.urlType | <code>string</code> | default 'external', type of URL to return 'internal' or 'external' |

<a name="Files+revokeAllPresignURLs"></a>

### *files.revokeAllPresignURLs() ⇒ <code>void</code>*
Revoke all generated pre-sign URLs

**Kind**: instance method of [<code>Files</code>](#Files)  
<a name="init"></a>

## init([config]) ⇒ [<code>Promise.&lt;Files&gt;</code>](#Files)
Initializes and returns the cloud files SDK.

To use the SDK you must either provide provide your
[OpenWhisk credentials](#OpenWhiskCredentials) in
`credentials.ow` or your own
[Azure blob storage credentials](#AzureCredentialsAccount) in `credentials.azure`.

OpenWhisk credentials can also be read from environment variables (`__OW_NAMESPACE` and `__OW_API_KEY`).

**Kind**: global function  
**Returns**: [<code>Promise.&lt;Files&gt;</code>](#Files) - A Files instance  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [config] | <code>object</code> | <code>{}</code> | configuration used to init the sdk |
| [config.ow] | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) |  | [OpenWhiskCredentials](#OpenWhiskCredentials). Set those if you want to use ootb credentials to access the state management service. OpenWhisk namespace and auth can also be passed through environment variables: `__OW_NAMESPACE` and `__OW_API_KEY` |
| [config.azure] | [<code>AzureCredentialsAccount</code>](#AzureCredentialsAccount) \| [<code>AzureCredentialsSAS</code>](#AzureCredentialsSAS) |  | bring your own [Azure SAS credentials](#AzureCredentialsSAS) or [Azure storage account credentials](#AzureCredentialsAccount) |
| [config.tvm] | <code>object</code> |  | tvm configuration, applies only when passing OpenWhisk credentials |
| [config.tvm.apiUrl] | <code>string</code> |  | alternative tvm api url. |
| [config.tvm.cacheFile] | <code>string</code> |  | alternative tvm cache file, set to `false` to disable caching of temporary credentials. |

<a name="FilePermissions"></a>

## FilePermissions : <code>Object</code>
Read, Write, Delete permission enum

**Kind**: global typedef  
<a name="UrlType"></a>

## UrlType : <code>Object</code>
external, internal URL type enum

**Kind**: global typedef  
<a name="OpenWhiskCredentials"></a>

## OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| namespace | <code>string</code> | user namespace |
| auth | <code>string</code> | auth key |

<a name="AzureCredentialsSAS"></a>

## AzureCredentialsSAS : <code>object</code>
SAS Azure credentials. The sdk needs two SAS credentials to allow access to
two already existing containers, a private and a public one (with access=`blob`).

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| sasURLPrivate | <code>string</code> | sas url to existing private azure blob container |
| sasURLPublic | <code>string</code> | sas url to existing public (with access=`blob`) azure blob container |

<a name="AzureCredentialsAccount"></a>

## AzureCredentialsAccount : <code>object</code>
Azure account credentials. Must have the permission to create containers.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| storageAccount | <code>string</code> | name of azure storage account |
| storageAccessKey | <code>string</code> | access key for azure storage account |
| containerName | <code>string</code> | name of container to store files. Another `${containerName}-public` will also be used for public files. |
| [hostName] | <code>string</code> | custom domain for returned URLs |

<a name="RemotePathString"></a>

## RemotePathString : <code>string</code>
a string to the remote path. If the path ends with a `/` it will
be treated as a directory, if not it will be treated as a file.

**Kind**: global typedef  
<a name="RemoteFileProperties"></a>

## RemoteFileProperties : <code>object</code>
File properties

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| name | <code>string</code> | unique name of this file, it is the full path |
| creationTime | <code>string</code> | utc datetime string when file was created |
| lastModified | <code>string</code> | utc datetime string when file last modified |
| etag | <code>string</code> | unique ( per modification ) etag for the asset |
| contentLength | <code>number</code> | size, in bytes |
| contentType | <code>string</code> | mime/type |
| isDirectory | <code>boolean</code> | true if file is a directory |
| isPublic | <code>boolean</code> | true if file is public |
| url | <code>string</code> | remote file URL with URI encoded path, use decodeURIComponent to decode the URL. |
| internalUrl | <code>string</code> | remote file URL which allows file access only from Adobe I/O Runtime actions. |

<a name="FilesLibError"></a>

## FilesLibError : <code>Error</code>
**Kind**: global typedef  
<a name="FilesLibErrors"></a>

## FilesLibErrors : <code>object</code>
Files lib custom errors.

`e.sdkDetails` provides additional context for each error (e.g. function parameter)

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| ERROR_BAD_ARGUMENT | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when an argument is missing or has invalid type |
| ERROR_NOT_IMPLEMENTED | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when a method is not implemented or when calling methods directly on the abstract class (Files). |
| ERROR_BAD_CREDENTIALS | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when the supplied init credentials are invalid. |
| ERROR_INTERNAL | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when an unknown error is thrown by the underlying provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`. |
| ERROR_FILE_NOT_EXISTS | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when the filePath does not exists for operations that need the file to exists (e.g. read) |
| ERROR_BAD_FILE_TYPE | [<code>FilesLibError</code>](#FilesLibError) | this error is thrown when the filePath is not the expected type for operations that need the file to be of a specific type, e.g. write on a dir would fail |

