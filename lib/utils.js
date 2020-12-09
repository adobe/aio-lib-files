const cloneDeep = require('lodash.clonedeep')
const { codes, logAndThrow } = require('./FilesError')

// eslint-disable-next-line jsdoc/require-jsdoc
async function wrapTVMRequest (promise, params) {
  return promise
    .catch(e => {
      if (e.sdkDetails.status === 401 || e.sdkDetails.status === 403) {
        logAndThrow(new codes.ERROR_BAD_CREDENTIALS({ messageValues: ['TVM'], sdkDetails: e.sdkDetails }))
      }
      throw e // throw raw tvm error
    })
}

// eslint-disable-next-line jsdoc/require-jsdoc
function withHiddenFields (toCopy, fields) {
  if (!toCopy) {
    return toCopy
  }
  const copyConfig = cloneDeep(toCopy)
  fields.forEach(f => {
    const keys = f.split('.')
    const lastKey = keys.slice(-1)[0]
    // keep last key
    const traverse = keys.slice(0, -1).reduce((obj, k) => obj && obj[k], copyConfig)

    if (traverse && traverse[lastKey]) {
      if (lastKey.startsWith('sasURL')) traverse[lastKey] = traverse[lastKey].split('?')[0] + '?<hidden>'
      else traverse[lastKey] = '<hidden>'
    }
  })
  return copyConfig
}

// eslint-disable-next-line jsdoc/require-jsdoc
function clone (toCopy) {
  return cloneDeep(toCopy)
}

module.exports = {
  withHiddenFields,
  wrapTVMRequest,
  clone
}
