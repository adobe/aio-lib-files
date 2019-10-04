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

const { ErrorWrapper, createUpdater } = require('@adobe/aio-lib-core-errors').AioCoreSDKErrorWrapper
const logger = require('@adobe/aio-lib-core-logging')('@adobe/aio-lib-files', { provider: './DebugLogger' })

const codes = {}
const messages = new Map()

const Updater = createUpdater(
  codes,
  messages
)

const E = ErrorWrapper(
  'FilesLibError',
  'FilesLib',
  Updater
)

// eslint-disable-next-line jsdoc/require-jsdoc
function logAndThrow (e) {
  const internalError = e.sdkDetails._internal
  // by default stringifying an Error returns '{}' when toJSON is not defined, so here we make sure that we properly
  // stringify the _internal error objects
  if (internalError instanceof Error && !internalError.toJSON) internalError.toJSON = () => Object.getOwnPropertyNames(internalError).reduce((obj, prop) => { obj[prop] = internalError[prop]; return obj }, {})
  logger.error(JSON.stringify(e, null, 2))
  throw e
}

E('ERROR_INTERNAL', '%s')
E('ERROR_BAD_ARGUMENT', '%s')
E('ERROR_NOT_IMPLEMENTED', 'method `%s` not implemented')
E('ERROR_BAD_CREDENTIALS', 'cannot access `%s`, make sure your credentials are valid')
E('ERROR_FILE_NOT_EXISTS', 'file `%s` does not exist')
E('ERROR_BAD_FILE_TYPE', '%s')
E('ERROR_OUT_OF_RANGE', '%s')

module.exports = {
  /** @type {module:types~RemotePathString} */
  codes,
  messages,
  logAndThrow
}
