## Classes

<dl>
<dt><a href="#Storage">Storage</a></dt>
<dd></dd>
<dt><a href="#TvmClient">TvmClient</a></dt>
<dd></dd>
<dt><a href="#TvmClient">TvmClient</a></dt>
<dd></dd>
<dt><a href="#AzureStorage">AzureStorage</a> ⇐ <code><a href="#Storage">Storage</a></code></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#init">init(credentials, [options])</a> ⇒ <code><a href="#Storage">Promise.&lt;Storage&gt;</a></code></dt>
<dd><p>Initializes and returns the storage SDK.</p>
<p>To use the SDK you must either provide provide your OpenWhisk credentials in
<code>credentials.ow</code> or your own cloud storage credentials in <code>credentials.azure</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables</p>
</dd>
<dt><a href="#urlJoin">urlJoin(...args)</a> ⇒ <code>string</code></dt>
<dd><p>Joins url path parts</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#AzureCredentials">AzureCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the credentials needed to instantiate AzureStorage.
It can either contain <code>{ sasURLPrivate, sasURLPublic }</code> or
<code>{ storageAccessKey, storage Account, containerName }</code>
In case you pass SAS URLs make sure the associated containers already exist</p>
</dd>
<dt><a href="#OpenWhiskCredentials">OpenWhiskCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the OpenWhisk credentials</p>
</dd>
<dt><a href="#RemotePathString">RemotePathString</a> : <code>string</code></dt>
<dd><p>a string to the remote file path. The path will be treated as
a directory if and only if it ends with a <code>/</code> otherwise it will be treated
as a plain file.</p>
</dd>
<dt><a href="#OpenWhiskCredentials">OpenWhiskCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the OpenWhisk credentials</p>
</dd>
<dt><a href="#RemotePathString">RemotePathString</a> : <code>string</code></dt>
<dd><p>a string to the remote file path. The path will be treated as
a directory if and only if it ends with a <code>/</code> otherwise it will be treated
as a plain file.</p>
</dd>
<dt><a href="#AzureCredentials">AzureCredentials</a> : <code>object</code></dt>
<dd><p>An object holding the credentials needed to instantiate AzureStorage.
It can either contain <code>{ sasURLPrivate, sasURLPublic }</code> or
<code>{ storageAccessKey, storage Account, containerName }</code>
In case you pass SAS URLs make sure the associated containers already exist</p>
</dd>
</dl>

<a name="Storage"></a>

## *Storage*
**Kind**: global abstract class  

* *[Storage](#Storage)*
    * *[new Storage()](#new_Storage_new)*
    * _instance_
        * *[._wrapProviderRequest(requestPromise, filePath)](#Storage+_wrapProviderRequest) ⇒ <code>Promise</code>*
        * *[.list([filePath])](#Storage+list) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
        * *[.delete(filePath, [options])](#Storage+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
        * *[.createReadStream(filePath, [options])](#Storage+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
        * *[.createWriteStream(filePath)](#Storage+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
        * *[.read(filePath, [options])](#Storage+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
        * *[.write(filePath, content)](#Storage+write) ⇒ <code>Promise.&lt;number&gt;</code>*
        * *[.getProperties(filePath)](#Storage+getProperties) ⇒ <code>Promise.&lt;RemoteFileProperties&gt;</code>*
        * *[._listFolder(filePath)](#Storage+_listFolder) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
        * *[._fileExists(filePath)](#Storage+_fileExists) ⇒ <code>Promise.&lt;boolean&gt;</code>*
        * *[._deleteFile(filePath)](#Storage+_deleteFile) ⇒ <code>Promise.&lt;string&gt;</code>*
        * *[._createReadStream(filePath, [options])](#Storage+_createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
        * *[._createWriteStream(filePath)](#Storage+_createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
        * *[._writeStream(filePath, content)](#Storage+_writeStream) ⇒ <code>Promise.&lt;number&gt;</code>*
        * *[._writeBuffer(filePath, content)](#Storage+_writeBuffer) ⇒ <code>Promise.&lt;number&gt;</code>*
        * **[._copyRemoteToRemoteFile(srcPath, destPath, options)](#Storage+_copyRemoteToRemoteFile) ⇒ <code>Promise.&lt;string&gt;</code>**
        * **[._getUrl(filePath)](#Storage+_getUrl) ⇒ <code>string</code>**
        * **[._statusFromProviderError(e)](#Storage+_statusFromProviderError) ⇒ <code>number</code>**
        * *[.copy(srcPath, destPath, [options])](#Storage+copy) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * _static_
        * *[.init(credentials)](#Storage.init) ⇒ [<code>Promise.&lt;Storage&gt;</code>](#Storage)*
        * *[._normalizeRemotePath(filePath)](#Storage._normalizeRemotePath) ⇒ <code>string</code>*
        * *[._isRemoteRoot(filePath)](#Storage._isRemoteRoot) ⇒ <code>boolean</code>*
        * *[._isRemotePublic(filePath)](#Storage._isRemotePublic) ⇒ <code>boolean</code>*
        * *[._isRemoteDirectory(filePath)](#Storage._isRemoteDirectory) ⇒ <code>boolean</code>*
        * *[._childRemotePath(parentFilePath, filePath, [relativeTo])](#Storage._childRemotePath) ⇒ <code>string</code>*
        * *[._throwIfRemoteDirectory(filePath)](#Storage._throwIfRemoteDirectory)*
        * *[._readStream(stream)](#Storage._readStream) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
        * *[.RemoteFileProperties](#Storage.RemoteFileProperties) : <code>object</code>*

<a name="new_Storage_new"></a>

### *new Storage()*
Abstract class for remote storage

<a name="Storage+_wrapProviderRequest"></a>

### *storage.\_wrapProviderRequest(requestPromise, filePath) ⇒ <code>Promise</code>*
Wraps errors for request to the cloud provider

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise</code> - promise resolving to same value as requestPromise  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| requestPromise | <code>Promise</code> | the promise resolving to the response or error |
| filePath | <code>string</code> | path to the file on which the request was made |

<a name="Storage+list"></a>

### *storage.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Lists files in a remote folder. If called on a file returns only this file path.
This is comparable to bash's `ls` command

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) if not specified list all files |

<a name="Storage+delete"></a>

### *storage.delete(filePath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Deletes a remote file or directory

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of deleted paths  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteDeleteOptions |
| [options.progressCallback] | <code>function</code> |  | cb(RemoteFile) is called after  the operation completed on each file |

<a name="Storage+createReadStream"></a>

### *storage.createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
**NODEJS ONLY**
**Does not work on directories.**
Creates a read stream

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+createWriteStream"></a>

### *storage.createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
**NODEJS ONLY**
**Does not work on directories.**
**[UNSTABLE] in case of problems use write(ReadableStream)**
Returns a write stream.
Use `.on('finish', (bytesWritten) => {})` to listen on completion event

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+read"></a>

### *storage.read(filePath, [options]) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
**Does not work on directories.**
Reads a remote file content

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer holding content  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteReadOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+write"></a>

### *storage.write(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
**Does not work on directories.**
Writes content to a file

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>string</code> \| <code>Buffer</code> \| <code>NodeJS.ReadableStream</code> | to be written, `ReadableStream` input works for **NodeJS only** |

<a name="Storage+getProperties"></a>

### *storage.getProperties(filePath) ⇒ <code>Promise.&lt;RemoteFileProperties&gt;</code>*
Reads properties of a file

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;RemoteFileProperties&gt;</code> - resolves to RemoteFileProperties  
**Throws**:

- <code>StorageError</code> 


| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_listFolder"></a>

### *storage.\_listFolder(filePath) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
[INTERNAL] only for folders

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_fileExists"></a>

### *storage.\_fileExists(filePath) ⇒ <code>Promise.&lt;boolean&gt;</code>*
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;boolean&gt;</code> - resolves to array of paths  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_deleteFile"></a>

### *storage.\_deleteFile(filePath) ⇒ <code>Promise.&lt;string&gt;</code>*
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;string&gt;</code> - resolves to filePath  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_createReadStream"></a>

### *storage.\_createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
**NODEJS ONLY**
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+_createWriteStream"></a>

### *storage.\_createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
**NODEJS ONLY**
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_writeStream"></a>

### *storage.\_writeStream(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
**NODEJS ONLY**
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>NodeJS.ReadableStream</code> | to be written |

<a name="Storage+_writeBuffer"></a>

### *storage.\_writeBuffer(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
[INTERNAL] only for files

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>Buffer</code> | to be written |

<a name="Storage+_copyRemoteToRemoteFile"></a>

### **storage.\_copyRemoteToRemoteFile(srcPath, destPath, options) ⇒ <code>Promise.&lt;string&gt;</code>**
**Does not work for directories.**
[INTERNAL] copies a file from a remote location to another.

**Kind**: instance abstract method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;string&gt;</code> - resolves to destPath  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| destPath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| options | <code>object</code> | options |

<a name="Storage+_getUrl"></a>

### **storage.\_getUrl(filePath) ⇒ <code>string</code>**
[INTERNAL]

**Kind**: instance abstract method of [<code>Storage</code>](#Storage)  
**Returns**: <code>string</code> - resolves to url  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+_statusFromProviderError"></a>

### **storage.\_statusFromProviderError(e) ⇒ <code>number</code>**
[INTERNAL]

**Kind**: instance abstract method of [<code>Storage</code>](#Storage)  
**Returns**: <code>number</code> - status code  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| e | <code>Error</code> | provider error response |

<a name="Storage+copy"></a>

### *storage.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
**NODEJS ONLY**
A utility to copy files and directories from and to remote or local locations

Rules for copy files are:
 1. Remote => Remote
   - a/ (dir) => b/: b/a/
   - a (file) => b/: b/a  *disallowed if b/a exists and override=false*
   - a (file) => b : b    *disallowed if b exists and override=false*
   - a/ (dir) => b : b/   *always allowed: in remote storage we can have both b and b/*
 2. Remote => Local
   - a/ => b/: b/a/
   - a  => b/: b/a
   - a  => b : b   *disallowed if b exists and override=false*
   - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
 3. Local => Remote
   - a/ => b/: b/a/
   - a  => b/: b/a  *disallowed if b/a exists and override=false*
   - a  => b : b    *disallowed if b exists and override=false*
   - a/ => b: b/    *always allowed: in remote storage we can have both b and b/*
 4. Local => Local
   - not supported

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - returns a promise resolving to an array
of copied file destination paths  
**Throws**:

- <code>StorageError</code> 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#RemotePathString) \| <code>string</code> |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#RemotePathString) \| <code>string</code> |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.override] | <code>boolean</code> | <code>false</code> | set to true to override existing files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file, a path to that file will be passed as argument to the callback `progressCallback(path)` |

<a name="Storage.init"></a>

### *Storage.init(credentials) ⇒ [<code>Promise.&lt;Storage&gt;</code>](#Storage)*
Initializes and returns a new storage instance

**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: [<code>Promise.&lt;Storage&gt;</code>](#Storage) - a new Storage instance  

| Param | Type | Description |
| --- | --- | --- |
| credentials | <code>object</code> | credentials for the cloud provider storage |

<a name="Storage._normalizeRemotePath"></a>

### *Storage.\_normalizeRemotePath(filePath) ⇒ <code>string</code>*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>string</code> - normalized path  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage._isRemoteRoot"></a>

### *Storage.\_isRemoteRoot(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>boolean</code> - true if it's the root  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage._isRemotePublic"></a>

### *Storage.\_isRemotePublic(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>boolean</code> - true if the file is public  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage._isRemoteDirectory"></a>

### *Storage.\_isRemoteDirectory(filePath) ⇒ <code>boolean</code>*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>boolean</code> - true if path is a directory  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage._childRemotePath"></a>

### *Storage.\_childRemotePath(parentFilePath, filePath, [relativeTo]) ⇒ <code>string</code>*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>string</code> - child path  
**Access**: protected  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| parentFilePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [relativeTo] | <code>string</code> | <code>&quot;&#x27;&#x27;&quot;</code> | set this to keep a sub path from relativeTo to filePath, if not set only the filename will be appended to the parentFilePath |

<a name="Storage._throwIfRemoteDirectory"></a>

### *Storage.\_throwIfRemoteDirectory(filePath)*
**Kind**: static method of [<code>Storage</code>](#Storage)  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage._readStream"></a>

### *Storage.\_readStream(stream) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
Reads a stream into a buffer

**Kind**: static method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| stream | <code>NodeJS.ReadableStream</code> | readableStream |

<a name="Storage.RemoteFileProperties"></a>

### *Storage.RemoteFileProperties : <code>object</code>*
**Kind**: static typedef of [<code>Storage</code>](#Storage)  
**Access**: public  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| isDirectory | <code>boolean</code> | true if file is a path |
| isPublic | <code>boolean</code> | true if file is public |
| url | <code>string</code> | remote file url |

<a name="TvmClient"></a>

## TvmClient
**Kind**: global class  

* [TvmClient](#TvmClient)
    * [new TvmClient()](#new_TvmClient_new)
    * [new TvmClient(config)](#new_TvmClient_new)
    * [.getAzureBlobCredentials()](#TvmClient+getAzureBlobCredentials) ⇒ <code>Promise.&lt;object&gt;</code>

<a name="new_TvmClient_new"></a>

### new TvmClient()
A client to the Token Vending Machine

<a name="new_TvmClient_new"></a>

### new TvmClient(config)

| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> | TvmClientParams |
| config.apiUrl | <code>string</code> | url to tvm api |
| config.ow | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) | openwhisk credentials |
| [config.cacheFile] | <code>string</code> | if omitted defaults to tmpdir/.tvmCache, use false or null to not cache |

<a name="TvmClient+getAzureBlobCredentials"></a>

### tvmClient.getAzureBlobCredentials() ⇒ <code>Promise.&lt;object&gt;</code>
Reads the credentials for Azure blob storage from the TVM or cache

**Kind**: instance method of [<code>TvmClient</code>](#TvmClient)  
**Returns**: <code>Promise.&lt;object&gt;</code> - credentials for service  
<a name="TvmClient"></a>

## TvmClient
**Kind**: global class  

* [TvmClient](#TvmClient)
    * [new TvmClient()](#new_TvmClient_new)
    * [new TvmClient(config)](#new_TvmClient_new)
    * [.getAzureBlobCredentials()](#TvmClient+getAzureBlobCredentials) ⇒ <code>Promise.&lt;object&gt;</code>

<a name="new_TvmClient_new"></a>

### new TvmClient()
A client to the Token Vending Machine

<a name="new_TvmClient_new"></a>

### new TvmClient(config)

| Param | Type | Description |
| --- | --- | --- |
| config | <code>object</code> | TvmClientParams |
| config.apiUrl | <code>string</code> | url to tvm api |
| config.ow | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) | openwhisk credentials |
| [config.cacheFile] | <code>string</code> | if omitted defaults to tmpdir/.tvmCache, use false or null to not cache |

<a name="TvmClient+getAzureBlobCredentials"></a>

### tvmClient.getAzureBlobCredentials() ⇒ <code>Promise.&lt;object&gt;</code>
Reads the credentials for Azure blob storage from the TVM or cache

**Kind**: instance method of [<code>TvmClient</code>](#TvmClient)  
**Returns**: <code>Promise.&lt;object&gt;</code> - credentials for service  
<a name="AzureStorage"></a>

## AzureStorage ⇐ [<code>Storage</code>](#Storage)
**Kind**: global class  
**Extends**: [<code>Storage</code>](#Storage)  

* [AzureStorage](#AzureStorage) ⇐ [<code>Storage</code>](#Storage)
    * [new AzureStorage()](#new_AzureStorage_new)
    * _instance_
        * [._azure](#AzureStorage+_azure)
        * [._wrapProviderRequest(requestPromise, filePath)](#Storage+_wrapProviderRequest) ⇒ <code>Promise</code>
        * [.list([filePath])](#Storage+list) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
        * [.delete(filePath, [options])](#Storage+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
        * [.createReadStream(filePath, [options])](#Storage+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>
        * [.createWriteStream(filePath)](#Storage+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>
        * [.read(filePath, [options])](#Storage+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>
        * [.write(filePath, content)](#Storage+write) ⇒ <code>Promise.&lt;number&gt;</code>
        * [.getProperties(filePath)](#Storage+getProperties) ⇒ <code>Promise.&lt;RemoteFileProperties&gt;</code>
        * [.copy(srcPath, destPath, [options])](#Storage+copy) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
    * _static_
        * [.init(credentials)](#AzureStorage.init) ⇒ [<code>Promise.&lt;AzureStorage&gt;</code>](#AzureStorage)

<a name="new_AzureStorage_new"></a>

### new AzureStorage()
Storage implementation for Azure

<a name="AzureStorage+_azure"></a>

### azureStorage.\_azure
**Kind**: instance property of [<code>AzureStorage</code>](#AzureStorage)  
**Access**: protected  
<a name="Storage+_wrapProviderRequest"></a>

### azureStorage.\_wrapProviderRequest(requestPromise, filePath) ⇒ <code>Promise</code>
Wraps errors for request to the cloud provider

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise</code> - promise resolving to same value as requestPromise  
**Throws**:

- <code>StorageError</code> 

**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| requestPromise | <code>Promise</code> | the promise resolving to the response or error |
| filePath | <code>string</code> | path to the file on which the request was made |

<a name="Storage+list"></a>

### azureStorage.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Lists files in a remote folder. If called on a file returns only this file path.
This is comparable to bash's `ls` command

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) if not specified list all files |

<a name="Storage+delete"></a>

### azureStorage.delete(filePath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
Deletes a remote file or directory

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of deleted paths  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteDeleteOptions |
| [options.progressCallback] | <code>function</code> |  | cb(RemoteFile) is called after  the operation completed on each file |

<a name="Storage+createReadStream"></a>

### azureStorage.createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>
**NODEJS ONLY**
**Does not work on directories.**
Creates a read stream

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+createWriteStream"></a>

### azureStorage.createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>
**NODEJS ONLY**
**Does not work on directories.**
**[UNSTABLE] in case of problems use write(ReadableStream)**
Returns a write stream.
Use `.on('finish', (bytesWritten) => {})` to listen on completion event

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+read"></a>

### azureStorage.read(filePath, [options]) ⇒ <code>Promise.&lt;Buffer&gt;</code>
**Does not work on directories.**
Reads a remote file content

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer holding content  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) |  | [RemotePathString](#RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteReadOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+write"></a>

### azureStorage.write(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>
**Does not work on directories.**
Writes content to a file

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Throws**:

- <code>StorageError</code> 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |
| content | <code>string</code> \| <code>Buffer</code> \| <code>NodeJS.ReadableStream</code> | to be written, `ReadableStream` input works for **NodeJS only** |

<a name="Storage+getProperties"></a>

### azureStorage.getProperties(filePath) ⇒ <code>Promise.&lt;RemoteFileProperties&gt;</code>
Reads properties of a file

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;RemoteFileProperties&gt;</code> - resolves to RemoteFileProperties  
**Throws**:

- <code>StorageError</code> 


| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#RemotePathString) | [RemotePathString](#RemotePathString) |

<a name="Storage+copy"></a>

### azureStorage.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>
**NODEJS ONLY**
A utility to copy files and directories from and to remote or local locations

Rules for copy files are:
 1. Remote => Remote
   - a/ (dir) => b/: b/a/
   - a (file) => b/: b/a  *disallowed if b/a exists and override=false*
   - a (file) => b : b    *disallowed if b exists and override=false*
   - a/ (dir) => b : b/   *always allowed: in remote storage we can have both b and b/*
 2. Remote => Local
   - a/ => b/: b/a/
   - a  => b/: b/a
   - a  => b : b   *disallowed if b exists and override=false*
   - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
 3. Local => Remote
   - a/ => b/: b/a/
   - a  => b/: b/a  *disallowed if b/a exists and override=false*
   - a  => b : b    *disallowed if b exists and override=false*
   - a/ => b: b/    *always allowed: in remote storage we can have both b and b/*
 4. Local => Local
   - not supported

**Kind**: instance method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - returns a promise resolving to an array
of copied file destination paths  
**Throws**:

- <code>StorageError</code> 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#RemotePathString) \| <code>string</code> |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#RemotePathString) \| <code>string</code> |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.override] | <code>boolean</code> | <code>false</code> | set to true to override existing files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file, a path to that file will be passed as argument to the callback `progressCallback(path)` |

<a name="AzureStorage.init"></a>

### AzureStorage.init(credentials) ⇒ [<code>Promise.&lt;AzureStorage&gt;</code>](#AzureStorage)
Creates and return an instance of AzureStorage. Also creates needed azure
containers if credentials are not SAS

**Kind**: static method of [<code>AzureStorage</code>](#AzureStorage)  
**Returns**: [<code>Promise.&lt;AzureStorage&gt;</code>](#AzureStorage) - new instance  

| Param | Type | Description |
| --- | --- | --- |
| credentials | [<code>AzureCredentials</code>](#AzureCredentials) | [AzureCredentials](#AzureCredentials) |

<a name="init"></a>

## init(credentials, [options]) ⇒ [<code>Promise.&lt;Storage&gt;</code>](#Storage)
Initializes and returns the storage SDK.

To use the SDK you must either provide provide your OpenWhisk credentials in
`credentials.ow` or your own cloud storage credentials in `credentials.azure`.

OpenWhisk credentials can also be read from environment variables

**Kind**: global function  
**Returns**: [<code>Promise.&lt;Storage&gt;</code>](#Storage) - A storage instance  
**Throws**:

- <code>StorageError</code> 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| credentials | <code>object</code> |  | used to init the sdk |
| [credentials.ow] | [<code>OpenWhiskCredentials</code>](#OpenWhiskCredentials) |  | OpenWhisk credentials, set those if you want to use our storage auto-generated temporary cloud storage credentials from the token vending machine (tvm) for our storage infrastructure. You can also pass the namespace and auth through environment variables: `OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH` |
| [credentials.azure] | [<code>AzureCredentials</code>](#AzureCredentials) |  | [AzureCredentials](#AzureCredentials) |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.tvmApiUrl] | <code>string</code> |  | alternative tvm api url, works only together with credentials.ow |
| [options.tvmCacheFile] | <code>string</code> |  | alternative tvm cache file, defaults to tmp `<tmpfolder>/.tvmCache`. Set to `false` to disable caching. Works only together with credentials.ow |

<a name="urlJoin"></a>

## urlJoin(...args) ⇒ <code>string</code>
Joins url path parts

**Kind**: global function  
**Returns**: <code>string</code> - joined url  

| Param | Type | Description |
| --- | --- | --- |
| ...args | <code>string</code> | url parts |

<a name="AzureCredentials"></a>

## AzureCredentials : <code>object</code>
An object holding the credentials needed to instantiate AzureStorage.
It can either contain `{ sasURLPrivate, sasURLPublic }` or
`{ storageAccessKey, storage Account, containerName }`
In case you pass SAS URLs make sure the associated containers already exist

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [sasURLPrivate] | <code>string</code> | sas url to existing private azure blob container |
| [sasURLPublic] | <code>string</code> | sas url to existing public azure blob container |
| [storageAccount] | <code>string</code> | name of azure storage account |
| [storageAccessKey] | <code>string</code> | access key for azure storage account |
| [containerName] | <code>string</code> | name of the blob container. Another `${containerName}-public` container will also be used. Non existing containers will be created. |

<a name="OpenWhiskCredentials"></a>

## OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [namespace] | <code>string</code> | user namespace |
| [auth] | <code>string</code> | auth key |

<a name="RemotePathString"></a>

## RemotePathString : <code>string</code>
a string to the remote file path. The path will be treated as
a directory if and only if it ends with a `/` otherwise it will be treated
as a plain file.

**Kind**: global typedef  
<a name="OpenWhiskCredentials"></a>

## OpenWhiskCredentials : <code>object</code>
An object holding the OpenWhisk credentials

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [namespace] | <code>string</code> | user namespace |
| [auth] | <code>string</code> | auth key |

<a name="RemotePathString"></a>

## RemotePathString : <code>string</code>
a string to the remote file path. The path will be treated as
a directory if and only if it ends with a `/` otherwise it will be treated
as a plain file.

**Kind**: global typedef  
<a name="AzureCredentials"></a>

## AzureCredentials : <code>object</code>
An object holding the credentials needed to instantiate AzureStorage.
It can either contain `{ sasURLPrivate, sasURLPublic }` or
`{ storageAccessKey, storage Account, containerName }`
In case you pass SAS URLs make sure the associated containers already exist

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| [sasURLPrivate] | <code>string</code> | sas url to existing private azure blob container |
| [sasURLPublic] | <code>string</code> | sas url to existing public azure blob container |
| [storageAccount] | <code>string</code> | name of azure storage account |
| [storageAccessKey] | <code>string</code> | access key for azure storage account |
| [containerName] | <code>string</code> | name of the blob container. Another `${containerName}-public` container will also be used. Non existing containers will be created. |

