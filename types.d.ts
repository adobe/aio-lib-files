/**
 * @abstract
 * @class Files
 * @classdesc Cloud Files Abstraction
 * @hideconstructor
 */
declare class Files {
    /**
     * Lists files in a remote folder. If called on a file returns only this file path.
     * This is comparable to bash's `ls` command
     *
     * @param {RemotePathString} [filePath] {@link RemotePathString} if not
     * specified list all files
     * @returns {Promise<Array<string>>} resolves to array of paths
     *
     * @memberof Files
     * @public
     */
    public list(filePath?: RemotePathString): Promise<string[]>;
    /**
     * Deletes a remote file or directory
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @param {object} [options={}] remoteDeleteOptions
     * @param {Function} [options.progressCallback] cb(RemoteFile) is called after
     *  the operation completed on each file
     * @returns {Promise<Array<string>>} resolves to array of deleted paths
     *
     * @memberof Files
     * @public
     */
    public delete(filePath: RemotePathString, options?: {
        progressCallback?: (...params: any[]) => any;
    }): Promise<string[]>;
    /**
     * ***NodeJS only (streams). Does not work on directories.***
     *
     * Creates a read stream
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @param {object} [options={}] createReadStreamOptions
     * @param {number} [options.position] read start position of the file. By default is set to 0. If set to bigger than
     * size, throws an ERROR_OUT_OF_RANGE error
     * @param {number} [options.length] number of bytes to read. By default reads everything since starting position. If
     * set to bigger than file size, reads until end.
     * @returns {Promise<NodeJS.ReadableStream>} a readable stream
     *
     * @memberof Files
     * @public
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
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @returns {Promise<NodeJS.WritableStream>} a writable stream
     *
     * @memberof Files
     * @public
     */
    public createWriteStream(filePath: RemotePathString): Promise<NodeJS.WritableStream>;
    /**
     * ***Does not work on directories.***
     *
     * Reads a remote file content
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @returns {Promise<Buffer>} buffer holding content
     * @param {object} [options={}] remoteReadOptions
     * @param {number} [options.position] read start position of the file. By default is set to 0. If set to bigger than
     * size, throws an ERROR_OUT_OF_RANGE error
     * @param {number} [options.length] number of bytes to read. By default reads everything since starting position. If
     * set to bigger than file size, reads until end.
     *
     * @memberof Files
     * @public
     */
    public read(filePath: RemotePathString, options?: {
        position?: number;
        length?: number;
    }): Promise<Buffer>;
    /**
     * ***Does not work on directories.***
     *
     * Writes content to a file
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @param {string | Buffer | NodeJS.ReadableStream } content to be written,
     * `ReadableStream` input works for **NodeJS only**
     * @returns {Promise<number>} resolves to number of bytes written
     *
     * @memberof Files
     * @public
     */
    public write(filePath: RemotePathString, content: string | Buffer | NodeJS.ReadableStream): Promise<number>;
    /**
     * Reads properties of a file or directory
     *
     * @param {RemotePathString} filePath {@link RemotePathString}
     * @returns {Promise<RemoteFileProperties>} resolves {@link RemoteFileProperties}
     *
     * @memberof Files
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
     *    - a (file) => b/: b/a *does nothing if b/a exists and noOverwrite=true*
     *    - a (file) => b : b *does nothing if b exists and noOverwrite=true*
     *    - a/ (dir) => b : b/ *always allowed: in remote Files we can have both b and b/*
     *  2. Remote => Local
     *    - a/ => b/: b/a/
     *    - a  => b/: b/a *does nothing if b/a exists and noOverwrite=true*
     *    - a  => b : b *does nothing if b exists and noOverwrite=true*
     *    - a/ => b : b/ *throws an error if b exists and is a file: cannot copy a remote dir to a local file*
     *  3. Local => Remote
     *    - a/ => b/: b/a/
     *    - a  => b/: b/a *does nothing if b/a exists and noOverwrite=true*
     *    - a  => b : b *does nothing if b exists and noOverwrite=true*
     *    - a/ => b: b/ *always allowed: in remote Files we can have both b and b/*
     *  4. Local => Local
     *    - not supported
     *
     * @param {RemotePathString} srcPath copy source path to a file or directory. If
     * srcPath points to a local file set `options.localSrc` to true
     * @param {RemotePathString} destPath copy destination path to a file or directory. If
     * destPath points to a local file set `options.localDest` to true
     * @param {object} [options={}] remoteCopyOptions
     * @param {boolean} [options.localSrc = false] Set this option to true to copy
     * files from the local file system. Cannot be combined with localDest.
     * @param {boolean} [options.localDest = false] Set this option to true to
     * copy files to the local file system. Cannot be combined with localSrc.
     * @param {boolean} [options.noOverwrite = false] set to true to overwrite
     * existing files
     * @param {Function} [options.progressCallback] a function that will be called
     * every time the operation completes on a single file,the srcPath and destPath to the copied file
     * are passed as argument to the callback `progressCallback(srcPath, destPath)`
     * @returns {Promise<object<string, string>>} returns a promise resolving to an object containing all copied files
     * from src to dest `{ srcFilePath: destFilePath }`
     * @memberof Files
     */
    copy(srcPath: RemotePathString, destPath: RemotePathString, options?: {
        localSrc?: boolean;
        localDest?: boolean;
        noOverwrite?: boolean;
        progressCallback?: (...params: any[]) => any;
    }): Promise<{
        [key: string]: string;
    }>;
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
 *
 * @param {object} [config={}] configuration used to init the sdk
 *
 * @param {OpenWhiskCredentials} [config.ow]
 * {@link OpenWhiskCredentials}. Set those if you want
 * to use ootb credentials to access the state management service. OpenWhisk
 * namespace and auth can also be passed through environment variables:
 * `__OW_NAMESPACE` and `__OW_API_KEY`
 *
 * @param {AzureCredentialsAccount|AzureCredentialsSAS} [config.azure]
 * bring your own [Azure SAS credentials]{@link AzureCredentialsSAS} or
 * [Azure storage account credentials]{@link AzureCredentialsAccount}
 *
 * @param {object} [config.tvm] tvm configuration, applies only when passing OpenWhisk credentials
 * @param {string} [config.tvm.apiUrl] alternative tvm api url.
 * @param {string} [config.tvm.cacheFile] alternative tvm cache file, set to `false` to disable caching of temporary credentials.
 * @returns {Promise<Files>} A Files instance
 */
declare function init(config?: {
    ow?: OpenWhiskCredentials;
    azure?: AzureCredentialsAccount | AzureCredentialsSAS;
    tvm?: {
        apiUrl?: string;
        cacheFile?: string;
    };
}): Promise<Files>;

/**
 * An object holding the OpenWhisk credentials
 *
 * @typedef OpenWhiskCredentials
 * @type {object}
 * @property {string} namespace user namespace
 * @property {string} auth auth key
 */
declare type OpenWhiskCredentials = {
    namespace: string;
    auth: string;
};

/**
 * SAS Azure credentials. The sdk needs two SAS credentials to allow access to
 * two already existing containers, a private and a public one (with access=`blob`).
 *
 * @typedef AzureCredentialsSAS
 * @type {object}
 * @property {string} sasURLPrivate sas url to existing private azure blob
 * container
 * @property {string} sasURLPublic sas url to existing public (with
 * access=`blob`) azure blob container
 *
 */
declare type AzureCredentialsSAS = {
    sasURLPrivate: string;
    sasURLPublic: string;
};

/**
 * Azure account credentials. Must have the permission to create containers.
 *
 * @typedef AzureCredentialsAccount
 * @type {object}
 * @property {string} storageAccount name of azure storage account
 * @property {string} storageAccessKey access key for azure storage account
 * @property {string} containerName name of container to store files.
 * Another `${containerName}-public` will also be used for public files.
 */
declare type AzureCredentialsAccount = {
    storageAccount: string;
    storageAccessKey: string;
    containerName: string;
};

/**
 * @typedef RemotePathString
 * @type {string}
 * @description a string to the remote path. If the path ends with a `/` it will
 * be treated as a directory, if not it will be treated as a file.
 */
declare type RemotePathString = string;

/**
 * @typedef RemoteFileProperties
 * @type {object}
 * @property {boolean} isDirectory true if file is a path
 * @property {boolean} isPublic true if file is public
 * @property {string} url remote file URL with URI encoded path, use decodeURIComponent to decode the URL.
 */
declare type RemoteFileProperties = {
    isDirectory: boolean;
    isPublic: boolean;
    url: string;
};

/**
 * @typedef FilesLibError
 * @type {Error}
 *
 */
declare type FilesLibError = Error;

/**
 * Files lib custom errors.
 *
 * `e.sdkDetails` provides additional context for each error (e.g. function parameter)
 *
 * @typedef FilesLibErrors
 * @type {object}
 * @property {FilesLibError} ERROR_BAD_ARGUMENT this error is thrown when an argument is missing or has invalid type
 * @property {FilesLibError} ERROR_NOT_IMPLEMENTED this error is thrown when a method is not implemented or when calling
 * methods directly on the abstract class (Files).
 * @property {FilesLibError} ERROR_BAD_CREDENTIALS this error is thrown when the supplied init credentials are invalid.
 * @property {FilesLibError} ERROR_INTERNAL this error is thrown when an unknown error is thrown by the underlying
 * provider or TVM server for credential exchange. More details can be found in `e.sdkDetails._internal`.
 * @property {FilesLibError} ERROR_FILE_NOT_EXISTS this error is thrown when the filePath does not exists for operations
 * that need the file to exists (e.g. read)
 * @property {FilesLibError} ERROR_BAD_FILE_TYPE this error is thrown when the filePath is not the expected type for
 * operations that need the file to be of a specific type, e.g. write on a dir would fail
 */
declare type FilesLibErrors = {
    ERROR_BAD_ARGUMENT: FilesLibError;
    ERROR_NOT_IMPLEMENTED: FilesLibError;
    ERROR_BAD_CREDENTIALS: FilesLibError;
    ERROR_INTERNAL: FilesLibError;
    ERROR_FILE_NOT_EXISTS: FilesLibError;
    ERROR_BAD_FILE_TYPE: FilesLibError;
};

