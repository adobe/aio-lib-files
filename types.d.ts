/**
 * Read, Write, Delete permission enum
 */
export type FilePermissions = any;

/**
 * Cloud Files Abstraction
 */
export class Files {
    /**
     * @param filePath - {@link RemotePathString}
     * @returns normalized path
     */
    protected static _normalizeRemotePath(filePath: RemotePathString): string;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns true if it's the root
     */
    protected static _isRemoteRoot(filePath: RemotePathString): boolean;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns true if the file is public
     */
    protected static _isRemotePublic(filePath: RemotePathString): boolean;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns true if path is a directory
     */
    protected static _isRemoteDirectory(filePath: RemotePathString): boolean;
    /**
     * @param filePath - {@link RemotePathString}
     * @param details - pass details to error for debugging purpose (e.g. calling function params)
     */
    protected static _throwIfRemoteDirectory(filePath: RemotePathString, details: any): void;
    /**
     * Reads a stream into a buffer
     * @param stream - readableStream
     * @returns buffer
     */
    protected static _readStream(stream: NodeJS.ReadableStream): Promise<Buffer>;
    /**
     * Wraps errors for request to the cloud provider
     * @param requestPromise - the promise resolving to the response or error
     * @param details - pass details to error for debugging purpose (e.g. pass function params)
     * @param filePathToThrowOn404 - path to the file on which the request was made, if specified will throw on 404
     * @returns promise resolving to same value as requestPromise
     */
    protected _wrapProviderRequest(requestPromise: Promise, details: any, filePathToThrowOn404: string): Promise;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns resolves to array of {@link RemoteFileProperties}
     */
    protected _listFolder(filePath: RemotePathString): Promise<RemoteFileProperties[]>;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns resolves to boolean
     */
    protected _fileExists(filePath: RemotePathString): Promise<boolean>;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns resolves to boolean
     */
    protected _deleteFile(filePath: RemotePathString): Promise<boolean>;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns resolve to {@link RemoteFileProperties}
     */
    protected getFileInfo(filePath: RemotePathString): Promise<RemoteFileProperties>;
    /**
     * **NODEJS ONLY**
     * @param filePath - {@link RemotePathString}
     * @param [options = {}] - createReadStreamOptions
     * @param [options.position] - read start position of the file. By default is set to 0. If set to bigger than
     * size, throws an ERROR_OUT_OF_RANGE error
     * @param [options.length] - number of bytes to read. By default reads everything since starting position. If
     * set to bigger than file size, reads until end.
     * @returns a readable stream
     */
    protected _createReadStream(filePath: RemotePathString, options?: {
        position?: number;
        length?: number;
    }): Promise<NodeJS.ReadableStream>;
    /**
     * **NODEJS ONLY**
     * @param filePath - {@link RemotePathString}
     * @returns a writable stream
     */
    protected _createWriteStream(filePath: RemotePathString): Promise<NodeJS.WritableStream>;
    /**
     * **NODEJS ONLY**
     * @param filePath - {@link RemotePathString}
     * @param content - to be written
     * @returns resolves to number of bytes written
     */
    protected _writeStream(filePath: RemotePathString, content: NodeJS.ReadableStream): Promise<number>;
    /**
     * @param filePath - {@link RemotePathString}
     * @param content - to be written
     * @returns resolves to number of bytes written
     */
    protected _writeBuffer(filePath: RemotePathString, content: Buffer): Promise<number>;
    /**
     * **Does not work for directories.**
     * copies a file from a remote location to another.
     * @param srcPath - {@link RemotePathString}
     * @param destPath - {@link RemotePathString}
     */
    protected _copyRemoteToRemoteFile(srcPath: RemotePathString, destPath: RemotePathString): void;
    /**
     * @param filePath - {@link RemotePathString}
     * @returns resolves to url
     */
    protected _getUrl(filePath: RemotePathString): string;
    /**
     * [INTERNAL]
     * @param e - provider error response
     * @returns status code
     */
    protected _statusFromProviderError(e: Error): number;
    /**
     * Lists files in a remote folder. If called on a file returns the file info if the file exists.
     * If the file or folder does not exist returns an empty array.
     * @param [filePath] - {@link RemotePathString} if not
     * specified list all files
     * @returns resolves to array of {@link RemoteFileProperties}
     */
    public list(filePath?: RemotePathString): Promise<RemoteFileProperties[]>;
    /**
     * Deletes a remote file or directory
     * @param filePath - {@link RemotePathString}
     * @param [options = {}] - remoteDeleteOptions
     * @param [options.progressCallback] - cb(RemoteFile) is called after
     *  the operation completed on each file
     * @returns resolves to array of deleted paths
     */
    public delete(filePath: RemotePathString, options?: {
        progressCallback?: (...params: any[]) => any;
    }): Promise<string[]>;
    /**
     * ***NodeJS only (streams). Does not work on directories.***
     *
     * Creates a read stream
     * @param filePath - {@link RemotePathString}
     * @param [options = {}] - createReadStreamOptions
     * @param [options.position] - read start position of the file. By default is set to 0. If set to bigger than
     * size, throws an ERROR_OUT_OF_RANGE error
     * @param [options.length] - number of bytes to read. By default reads everything since starting position. If
     * set to bigger than file size, reads until end.
     * @returns a readable stream
     */
    public createReadStream(filePath: RemotePathString, options?: {
        position?: number;
        length?: number;
    }): Promise<NodeJS.ReadableStream>;
    /**
     * **[UNSTABLE] please prefer using `write(<NodeJS.ReadableStream>)`**
     *
     * ***NodeJS only (streams). Does not work on directories.***
     *
     * Returns a write stream.
     * Use `stream.on('finish', (bytesWritten) => {})` to listen on completion event
     * @param filePath - {@link RemotePathString}
     * @returns a writable stream
     */
    public createWriteStream(filePath: RemotePathString): Promise<NodeJS.WritableStream>;
    /**
     * ***Does not work on directories.***
     *
     * Reads a remote file content
     * @param filePath - {@link RemotePathString}
     * @param [options = {}] - remoteReadOptions
     * @param [options.position] - read start position of the file. By default is set to 0. If set to bigger than
     * size, throws an ERROR_OUT_OF_RANGE error
     * @param [options.length] - number of bytes to read. By default reads everything since starting position. If
     * set to bigger than file size, reads until end.
     * @returns buffer holding content
     */
    public read(filePath: RemotePathString, options?: {
        position?: number;
        length?: number;
    }): Promise<Buffer>;
    /**
     * ***Does not work on directories.***
     *
     * Writes content to a file
     * @param filePath - {@link RemotePathString}
     * @param content - to be written,
     * `ReadableStream` input works for **NodeJS only**
     * @returns resolves to number of bytes written
     */
    public write(filePath: RemotePathString, content: string | Buffer | NodeJS.ReadableStream): Promise<number>;
    /**
     * Reads properties of a file or directory
     * @param filePath - {@link RemotePathString}
     * @returns resolves {@link RemoteFileProperties}
     */
    getProperties(filePath: RemotePathString): Promise<RemoteFileProperties>;
    /**
     * ***NodeJS only (streams + fs).***
     *
     * A utility function to copy files and directories across remote and local Files.
     * This is comparable to the `scp` command
     *
     * Rules for copy files are:
     *  1. Remote => Remote
     *    - a/ (dir) => b/: b/a/
     *    - a (file) => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
     *    - a (file) => b : b    *does nothing if b exists and noOverwrite=true*
     *    - a/ (dir) => b : b/   *always allowed: in remote Files we can have both b and b/*
     *  2. Remote => Local
     *    - a/ => b/: b/a/
     *    - a  => b/: b/a *does nothing if b/a exists and noOverwrite=true*
     *    - a  => b : b   *does nothing if b exists and noOverwrite=true*
     *    - a/ => b : b/  *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
     *  3. Local => Remote
     *    - a/ => b/: b/a/
     *    - a  => b/: b/a  *does nothing if b/a exists and noOverwrite=true*
     *    - a  => b : b    *does nothing if b exists and noOverwrite=true*
     *    - a/ => b: b/    *always allowed: in remote Files we can have both b and b/*
     *  4. Local => Local
     *    - not supported
     * @param srcPath - copy source path to a file or directory. If
     * srcPath points to a local file set `options.localSrc` to true
     * @param destPath - copy destination path to a file or directory. If
     * destPath points to a local file set `options.localDest` to true
     * @param [options = {}] - remoteCopyOptions
     * @param [options.localSrc = false] - Set this option to true to copy
     * files from the local file system. Cannot be combined with localDest.
     * @param [options.localDest = false] - Set this option to true to
     * copy files to the local file system. Cannot be combined with localSrc.
     * @param [options.noOverwrite = false] - set to true to overwrite
     * existing files
     * @param [options.progressCallback] - a function that will be called
     * every time the operation completes on a single file,the srcPath and destPath to the copied file
     * are passed as argument to the callback `progressCallback(srcPath, destPath)`
     * @returns returns a promise resolving to an object containing all copied files
     * from src to dest `{ srcFilePath: destFilePath }`
     */
    copy(srcPath: RemotePathString, destPath: RemotePathString, options?: {
        localSrc?: boolean;
        localDest?: boolean;
        noOverwrite?: boolean;
        progressCallback?: (...params: any[]) => any;
    }): Promise<{
        [key: string]: string;
    }>;
    /**
     * Generate pre-sign URLs for a private file
     * @param filePath - {@link RemotePathString}
     * @param options - Options to generate presign URL
     * @param options.expiryInSeconds - presign URL expiry duration
     * @param options.permissions - permissions for presigned URL (any combination of rwd)
     * @returns Presign URL for the given file
     */
    generatePresignURL(filePath: RemotePathString, options: {
        expiryInSeconds: number;
        permissions: string;
    }): Promise<string>;
    /**
     * Revoke all generated pre-sign URLs
     */
    revokeAllPresignURLs(): void;
}

/**
 * Initializes and returns the cloud files SDK.
 *
 * To use the SDK you must either provide provide your
 * [OpenWhisk credentials]{@link OpenWhiskCredentials} in
 * `credentials.ow` or your own
 * [Azure blob storage credentials]{@link AzureCredentialsAccount} in `credentials.azure`.
 *
 * OpenWhisk credentials can also be read from environment variables (`__OW_NAMESPACE` and `__OW_API_KEY`).
 * @param [config = {}] - configuration used to init the sdk
 * @param [config.ow] - {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 * @param [config.azure] - bring your own [Azure SAS credentials]{@link AzureCredentialsSAS} or
 * [Azure storage account credentials]{@link AzureCredentialsAccount}
 * @param [config.tvm] - tvm configuration, applies only when passing OpenWhisk credentials
 * @param [config.tvm.apiUrl] - alternative tvm api url.
 * @param [config.tvm.cacheFile] - alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns A Files instance
 */
export function init(config?: {
    ow?: OpenWhiskCredentials;
    azure?: AzureCredentialsAccount | AzureCredentialsSAS;
    tvm?: {
        apiUrl?: string;
        cacheFile?: string;
    };
}): Promise<Files>;

/**
 * An object holding the OpenWhisk credentials
 * @property namespace - user namespace
 * @property auth - auth key
 */
export type OpenWhiskCredentials = {
    namespace: string;
    auth: string;
};

/**
 * SAS Azure credentials. The sdk needs two SAS credentials to allow access to
 * two already existing containers, a private and a public one (with access=`blob`).
 * @property sasURLPrivate - sas url to existing private azure blob
 * container
 * @property sasURLPublic - sas url to existing public (with
 * access=`blob`) azure blob container
 */
export type AzureCredentialsSAS = {
    sasURLPrivate: string;
    sasURLPublic: string;
};

/**
 * Azure account credentials. Must have the permission to create containers.
 * @property storageAccount - name of azure storage account
 * @property storageAccessKey - access key for azure storage account
 * @property containerName - name of container to store files.
 * Another `${containerName}-public` will also be used for public files.
 * @property [hostName] - custom domain for returned URLs
 */
export type AzureCredentialsAccount = {
    storageAccount: string;
    storageAccessKey: string;
    containerName: string;
    hostName?: string;
};

/**
 * a string to the remote path. If the path ends with a `/` it will
 * be treated as a directory, if not it will be treated as a file.
 */
export type RemotePathString = string;

/**
 * File properties
 * @property name - unique name of this file, it is the full path
 * @property creationTime - utc datetime string when file was created
 * @property lastModified - utc datetime string when file last modified
 * @property etag - unique ( per modification ) etag for the asset
 * @property contentLength - size, in bytes
 * @property contentType - mime/type
 * @property isDirectory - true if file is a directory
 * @property isPublic - true if file is public
 * @property url - remote file URL with URI encoded path, use decodeURIComponent to decode the URL.
 */
export type RemoteFileProperties = {
    name: string;
    creationTime: string;
    lastModified: string;
    etag: string;
    contentLength: number;
    contentType: string;
    isDirectory: boolean;
    isPublic: boolean;
    url: string;
};

export type FilesLibError = Error;

/**
 * Files lib custom errors.
 *
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 * @property ERROR_BAD_ARGUMENT - this error is thrown when an argument is missing or has invalid type
 * @property ERROR_NOT_IMPLEMENTED - this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (Files).
 * @property ERROR_BAD_CREDENTIALS - this error is thrown when the supplied init credentials are invalid.
 * @property ERROR_INTERNAL - this error is thrown when an unknown error is thrown by the underlying
 * provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 * @property ERROR_FILE_NOT_EXISTS - this error is thrown when the filePath does not exists for operations
 * that need the file to exists (e.g. read)
 * @property ERROR_BAD_FILE_TYPE - this error is thrown when the filePath is not the expected type for
 * operations that need the file to be of a specific type, e.g. write on a dir would fail
 */
export type FilesLibErrors = {
    ERROR_BAD_ARGUMENT: FilesLibError;
    ERROR_NOT_IMPLEMENTED: FilesLibError;
    ERROR_BAD_CREDENTIALS: FilesLibError;
    ERROR_INTERNAL: FilesLibError;
    ERROR_FILE_NOT_EXISTS: FilesLibError;
    ERROR_BAD_FILE_TYPE: FilesLibError;
};

