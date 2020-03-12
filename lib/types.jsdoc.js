/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* istanbul ignore file */

/**
 * An object holding the OpenWhisk credentials
 *
 * @typedef OpenWhiskCredentials
 * @type {object}
 * @property {string} namespace user namespace
 * @property {string} auth auth key
 */

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
/**
 * @typedef RemotePathString
 * @type {string}
 * @description a string to the remote path. If the path ends with a `/` it will
 * be treated as a directory, if not it will be treated as a file.
 */

/**
 * @typedef RemoteFileProperties
 * @type {object}
 * @property {boolean} isDirectory true if file is a path
 * @property {boolean} isPublic true if file is public
 * @property {string} url remote file URL with URI encoded path, use decodeURIComponent to decode the URL.
 */

/**
 * @typedef FilesLibError
 * @type {Error}
 *
 */

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
