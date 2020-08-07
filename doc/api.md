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
<dd></dd>
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
    * _instance_
        * *[._wrapProviderRequest(requestPromise, details, filePath)](#Files+_wrapProviderRequest) ⇒ <code>Promise</code>*
        * **[._listFolder(filePath)](#Files+_listFolder) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>**
        * **[._fileExists(filePath)](#Files+_fileExists) ⇒ <code>Promise.&lt;boolean&gt;</code>**
        * **[._deleteFile(filePath)](#Files+_deleteFile)**
        * **[._createReadStream(filePath, [options])](#Files+_createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>**
        * **[._createWriteStream(filePath)](#Files+_createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>**
        * **[._writeStream(filePath, content)](#Files+_writeStream) ⇒ <code>Promise.&lt;number&gt;</code>**
        * **[._writeBuffer(filePath, content)](#Files+_writeBuffer) ⇒ <code>Promise.&lt;number&gt;</code>**
        * **[._copyRemoteToRemoteFile(srcPath, destPath)](#Files+_copyRemoteToRemoteFile)**
        * **[._getUrl(filePath)](#Files+_getUrl) ⇒ <code>string</code>**
        * **[._statusFromProviderError(e)](#Files+_statusFromProviderError) ⇒ <code>number</code>**
        * *[.list([filePath])](#Files+list) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
        * *[.delete(filePath, [options])](#Files+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
        * *[.createReadStream(filePath, [options])](#Files+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
        * *[.createWriteStream(filePath)](#Files+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
        * *[.read(filePath, [options])](#Files+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
        * *[.write(filePath, content)](#Files+write) ⇒ <code>Promise.&lt;number&gt;</code>*
        * *[.getProperties(filePath)](#Files+getProperties) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties)*
        * *[.copy(srcPath, destPath, [options])](#Files+copy) ⇒ <code>Promise.&lt;object.&lt;string, string&gt;&gt;</code>*
        * *[.generatePresignURL(filePath, options)](#Files+generatePresignURL) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties)*
    * _static_
        * *[._normalizeRemotePath(filePath)](#Files._normalizeRemotePath) ⇒ <code>string</code>*
        * *[._isRemoteRoot(filePath)](#Files._isRemoteRoot) ⇒ <code>boolean</code>*
        * *[._isRemotePublic(filePath)](#Files._isRemotePublic) ⇒ <code>boolean</code>*
        * *[._isRemoteDirectory(filePath)](#Files._isRemoteDirectory) ⇒ <code>boolean</code>*
        * *[._throwIfRemoteDirectory(filePath, details)](#Files._throwIfRemoteDirectory)*
        * *[._readStream(stream)](#Files._readStream) ⇒ <code>Promise.&lt;Buffer&gt;</code>*

<a name="Files+_wrapProviderRequest"></a>

### *files.\_wrapProviderRequest(requestPromise, details, filePath) ⇒ <code>Promise</code>*
Wraps errors for request to the cloud provider

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise</code> - promise resolving to same value as requestPromise  
**Throws**:

- <code>codes.ERROR\_BAD\_CREDENTIALS</code><code>codes.ERROR\_FILE\_NOT\_EXISTS</code><code>codes.ERROR\_INTERNAL</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| requestPromise | <code>Promise</code> | the promise resolving to the response or error |
| details | <code>object</code> | pass details to error for debugging purpose (e.g. pass function params) |
| filePath | <code>string</code> | path to the file on which the request was made |

<a name="Files+_listFolder"></a>

### **files.\_listFolder(filePath) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>**
**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_fileExists"></a>

### **files.\_fileExists(filePath) ⇒ <code>Promise.&lt;boolean&gt;</code>**
**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - resolves to array of paths  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_deleteFile"></a>

### **files.\_deleteFile(filePath)**
**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_createReadStream"></a>

### **files.\_createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>**
**NODEJS ONLY**

**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Access**: protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file. By default is set to 0. If set to bigger than size, throws an ERROR_OUT_OF_RANGE error |
| [options.length] | <code>number</code> |  | number of bytes to read. By default reads everything since starting position. If set to bigger than file size, reads until end. |

<a name="Files+_createWriteStream"></a>

### **files.\_createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>**
**NODEJS ONLY**

**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_writeStream"></a>

### **files.\_writeStream(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>**
**NODEJS ONLY**

**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>NodeJS.ReadableStream</code> | to be written |

<a name="Files+_writeBuffer"></a>

### **files.\_writeBuffer(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>**
**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>Buffer</code> | to be written |

<a name="Files+_copyRemoteToRemoteFile"></a>

### **files.\_copyRemoteToRemoteFile(srcPath, destPath)**
**Does not work for directories.**
copies a file from a remote location to another.

**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| destPath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_getUrl"></a>

### **files.\_getUrl(filePath) ⇒ <code>string</code>**
**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>string</code> - resolves to url  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files+_statusFromProviderError"></a>

### **files.\_statusFromProviderError(e) ⇒ <code>number</code>**
[INTERNAL]

**Kind**: instance abstract method of [<code>Files</code>](#Files)  
**Returns**: <code>number</code> - status code  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>Error</code> | provider error response |

<a name="Files+list"></a>

### *files.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Lists files in a remote folder. If called on a file returns only this file path.
This is comparable to bash's `ls` command

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) if not specified list all files |

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

### *files.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;object.&lt;string, string&gt;&gt;</code>*
***NodeJS only (streams + fs).***

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
| srcPath | [<code>RemotePathString</code>](#RemotePathString) |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#RemotePathString) |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.noOverwrite] | <code>boolean</code> | <code>false</code> | set to true to overwrite existing files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file,the srcPath and destPath to the copied file are passed as argument to the callback `progressCallback(srcPath, destPath)` |

<a name="Files+generatePresignURL"></a>

### *files.generatePresignURL(filePath, options) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties)*
Generate pre-sign URLs for a private file

**Kind**: instance method of [<code>Files</code>](#Files)  
**Returns**: [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#RemoteFileProperties) - resolves [RemoteFileProperties](#RemoteFileProperties)  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| options | <code>object</code> | Options for presign URL |

<a name="Files._normalizeRemotePath"></a>

### *Files.\_normalizeRemotePath(filePath) ⇒ <code>string</code>*
**Kind**: static method of [<code>Files</code>](#Files)  
**Returns**: <code>string</code> - normalized path  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files._isRemoteRoot"></a>

### *Files.\_isRemoteRoot(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Files</code>](#Files)  
**Returns**: <code>boolean</code> - true if it's the root  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files._isRemotePublic"></a>

### *Files.\_isRemotePublic(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Files</code>](#Files)  
**Returns**: <code>boolean</code> - true if the file is public  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files._isRemoteDirectory"></a>

### *Files.\_isRemoteDirectory(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Files</code>](#Files)  
**Returns**: <code>boolean</code> - true if path is a directory  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Files._throwIfRemoteDirectory"></a>

### *Files.\_throwIfRemoteDirectory(filePath, details)*
**Kind**: static method of [<code>Files</code>](#Files)  
**Throws**:

- <code>codes.ERROR\_BAD\_ARGUMENT</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| details | <code>object</code> | pass details to error for debugging purpose (e.g. calling function params) |

<a name="Files._readStream"></a>

### *Files.\_readStream(stream) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
Reads a stream into a buffer

**Kind**: static method of [<code>Files</code>](#Files)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| stream | <code>NodeJS.ReadableStream</code> | readableStream |

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

<a name="RemotePathString"></a>

## RemotePathString : <code>string</code>
a string to the remote path. If the path ends with a `/` it will
be treated as a directory, if not it will be treated as a file.

**Kind**: global typedef  
<a name="RemoteFileProperties"></a>

## RemoteFileProperties : <code>object</code>
**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| isDirectory | <code>boolean</code> | true if file is a path |
| isPublic | <code>boolean</code> | true if file is public |
| url | <code>string</code> | remote file URL with URI encoded path, use decodeURIComponent to decode the URL. |

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

