const cloneDeep = require('lodash.clonedeep')

// eslint-disable-next-line jsdoc/require-jsdoc
function withHiddenFields (toCopy, fields) {
  if (!toCopy) return toCopy
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

module.exports = {
  withHiddenFields
}
