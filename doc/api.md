## Modules

<dl>
<dt><a href="#module_types">types</a></dt>
<dd></dd>
</dl>

## Classes

<dl>
<dt><a href="#Storage">Storage</a></dt>
<dd><p>Cloud Storage</p>
</dd>
<dt><a href="#StorageError">StorageError</a> ⇐ <code>Error</code></dt>
<dd><p>Cloud Storage Errors</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#init">init(credentials, [options])</a> ⇒ <code><a href="#Storage">Promise.&lt;Storage&gt;</a></code></dt>
<dd><p>Initializes and returns the storage SDK.</p>
<p>To use the SDK you must either provide provide your
<a href="#module_types..OpenWhiskCredentials">OpenWhisk credentials</a> in
<code>credentials.ow</code> or your own
<a href="#module_types..AzureCredentialsAccount">Azure storage credentials</a> in <code>credentials.azure</code>.</p>
<p>OpenWhisk credentials can also be read from environment variables (<code>OW_NAMESPACE</code> or <code>__OW_NAMESPACE</code> and <code>OW_AUTH</code> or <code>__OW_AUTH</code>).</p>
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

<a name="Storage"></a>

## *Storage*
Cloud Storage

**Kind**: global abstract class  

* *[Storage](#Storage)*
    * *[.list([filePath])](#Storage+list) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * *[.delete(filePath, [options])](#Storage+delete) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
    * *[.createReadStream(filePath, [options])](#Storage+createReadStream) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
    * *[.createWriteStream(filePath)](#Storage+createWriteStream) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
    * *[.read(filePath, [options])](#Storage+read) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
    * *[.write(filePath, content)](#Storage+write) ⇒ <code>Promise.&lt;number&gt;</code>*
    * *[.getProperties(filePath)](#Storage+getProperties) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties)*
    * *[.copy(srcPath, destPath, [options])](#Storage+copy) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*

<a name="Storage+list"></a>

### *storage.list([filePath]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Lists files in a remote folder. If called on a file returns only this file path.
This is comparable to bash's `ls` command

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of paths  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| [filePath] | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) if not specified list all files |

<a name="Storage+delete"></a>

### *storage.delete(filePath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
Deletes a remote file or directory

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Array.&lt;string&gt;&gt;</code> - resolves to array of deleted paths  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteDeleteOptions |
| [options.progressCallback] | <code>function</code> |  | cb(RemoteFile) is called after  the operation completed on each file |

<a name="Storage+createReadStream"></a>

### *storage.createReadStream(filePath, [options]) ⇒ <code>Promise.&lt;NodeJS.ReadableStream&gt;</code>*
***NodeJS only (streams). Does not work on directories.***

Creates a read stream

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.ReadableStream&gt;</code> - a readable stream  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | createReadStreamOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+createWriteStream"></a>

### *storage.createWriteStream(filePath) ⇒ <code>Promise.&lt;NodeJS.WritableStream&gt;</code>*
**[UNSTABLE] please prefer using `write(<NodeJS.ReadableStream>)`**

***NodeJS only (streams). Does not work on directories.***

Returns a write stream.
Use `stream.on('finish', (bytesWritten) => {})` to listen on completion event

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;NodeJS.WritableStream&gt;</code> - a writable stream  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |

<a name="Storage+read"></a>

### *storage.read(filePath, [options]) ⇒ <code>Promise.&lt;Buffer&gt;</code>*
***Does not work on directories.***

Reads a remote file content

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;Buffer&gt;</code> - buffer holding content  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | [RemotePathString](#module_types..RemotePathString) |
| [options] | <code>object</code> | <code>{}</code> | remoteReadOptions |
| [options.position] | <code>number</code> |  | read start position of the file |
| [options.length] | <code>number</code> |  | number of bytes to read |

<a name="Storage+write"></a>

### *storage.write(filePath, content) ⇒ <code>Promise.&lt;number&gt;</code>*
***Does not work on directories.***

Writes content to a file

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: <code>Promise.&lt;number&gt;</code> - resolves to number of bytes written  
**Throws**:

- [<code>StorageError</code>](#StorageError) 

**Access**: public  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |
| content | <code>string</code> \| <code>Buffer</code> \| <code>NodeJS.ReadableStream</code> | to be written, `ReadableStream` input works for **NodeJS only** |

<a name="Storage+getProperties"></a>

### *storage.getProperties(filePath) ⇒ [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties)*
Reads properties of a file or directory

**Kind**: instance method of [<code>Storage</code>](#Storage)  
**Returns**: [<code>Promise.&lt;RemoteFileProperties&gt;</code>](#module_types..RemoteFileProperties) - resolves [RemoteFileProperties](#module_types..RemoteFileProperties)  

| Param | Type | Description |
| --- | --- | --- |
| filePath | [<code>RemotePathString</code>](#module_types..RemotePathString) | [RemotePathString](#module_types..RemotePathString) |

<a name="Storage+copy"></a>

### *storage.copy(srcPath, destPath, [options]) ⇒ <code>Promise.&lt;Array.&lt;string&gt;&gt;</code>*
***NodeJS only (streams).***

A utility function to copy files and directories across remote and local storage.
This is comparable to the `scp` command

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

- [<code>StorageError</code>](#StorageError) 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| srcPath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | copy source path to a file or directory. If srcPath points to a local file set `options.localSrc` to true |
| destPath | [<code>RemotePathString</code>](#module_types..RemotePathString) |  | copy destination path to a file or directory. If destPath points to a local file set `options.localDest` to true |
| [options] | <code>object</code> | <code>{}</code> | remoteCopyOptions |
| [options.localSrc] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files from the local file system. Cannot be combined with localDest. |
| [options.localDest] | <code>boolean</code> | <code>false</code> | Set this option to true to copy files to the local file system. Cannot be combined with localSrc. |
| [options.override] | <code>boolean</code> | <code>false</code> | set to true to override existing files |
| [options.progressCallback] | <code>function</code> |  | a function that will be called every time the operation completes on a single file, a path to that file will be passed as argument to the callback `progressCallback(path)` |

<a name="StorageError"></a>

## StorageError ⇐ <code>Error</code>
Cloud Storage Errors

**Kind**: global class  
**Extends**: <code>Error</code>  

* [StorageError](#StorageError) ⇐ <code>Error</code>
    * [.StorageError](#StorageError.StorageError)
        * [new StorageError(message, code, [internal])](#new_StorageError.StorageError_new)
    * [.codes](#StorageError.codes) : <code>enum</code>

<a name="StorageError.StorageError"></a>

### StorageError.StorageError
**Kind**: static class of [<code>StorageError</code>](#StorageError)  
<a name="new_StorageError.StorageError_new"></a>

#### new StorageError(message, code, [internal])
Creates an instance of StorageError.


| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | error message |
| code | [<code>codes</code>](#StorageError.codes) | Storage Error code |
| [internal] | <code>object</code> | debug error object for internal/underlying wrapped errors |

<a name="StorageError.codes"></a>

### StorageError.codes : <code>enum</code>
StorageError codes

**Kind**: static enum of [<code>StorageError</code>](#StorageError)  
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| Internal | <code>string</code> | <code>&quot;Internal&quot;</code> | 
| NotImplemented | <code>string</code> | <code>&quot;NotImplemented&quot;</code> | 
| BadArgument | <code>string</code> | <code>&quot;BadArgument&quot;</code> | 
| Forbidden | <code>string</code> | <code>&quot;Forbidden&quot;</code> | 
| FileNotExists | <code>string</code> | <code>&quot;FileNotExists&quot;</code> | 
| FileExistsNoOverrides | <code>string</code> | <code>&quot;FileExistsNoOverrides&quot;</code> | 
| BadFileType | <code>string</code> | <code>&quot;BadFileType&quot;</code> | 

<a name="init"></a>

## init(credentials, [options]) ⇒ [<code>Promise.&lt;Storage&gt;</code>](#Storage)
Initializes and returns the storage SDK.

To use the SDK you must either provide provide your
[OpenWhisk credentials](#module_types..OpenWhiskCredentials) in
`credentials.ow` or your own
[Azure storage credentials](#module_types..AzureCredentialsAccount) in `credentials.azure`.

OpenWhisk credentials can also be read from environment variables (`OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH`).

**Kind**: global function  
**Returns**: [<code>Promise.&lt;Storage&gt;</code>](#Storage) - A storage instance  
**Throws**:

- [<code>StorageError</code>](#StorageError) 


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| credentials | <code>object</code> |  | used to init the sdk |
| [credentials.ow] | [<code>OpenWhiskCredentials</code>](#module_types..OpenWhiskCredentials) |  | [OpenWhiskCredentials](#module_types..OpenWhiskCredentials). Set those if you want to use ootb credentials to access our storage infrastructure. OpenWhisk namespace and auth can also be passed through environment variables: `OW_NAMESPACE` or `__OW_NAMESPACE` and `OW_AUTH` or `__OW_AUTH` |
| [credentials.azure] | [<code>AzureCredentialsAccount</code>](#module_types..AzureCredentialsAccount) \| [<code>AzureCredentialsSAS</code>](#module_types..AzureCredentialsSAS) |  | bring your own [Azure SAS credentials](#module_types..AzureCredentialsSAS) or [Azure storage account credentials](#module_types..AzureCredentialsAccount) |
| [options] | <code>object</code> | <code>{}</code> | options |
| [options.tvmApiUrl] | <code>string</code> |  | alternative tvm api url. Only makes sense in the context of OpenWhisk credentials. |
| [options.tvmCacheFile] | <code>string</code> |  | alternative tvm cache file, defaults to `<tmpfolder>/.tvmCache`. Set to `false` to disable caching. Only makes sense in the context of OpenWhisk credentials. |

