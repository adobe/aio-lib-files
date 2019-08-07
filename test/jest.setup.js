const { StorageError } = require('../lib/StorageError')
expect.extend({
  async toThrowBadArgErrWithMessageContaining (received, args, checkErrorType = true) {
    if (typeof args === 'string') args = [args]
    try {
      await received()
    } catch (e) {
      if (checkErrorType && !(e instanceof StorageError)) {
        return { message: () => `expected error to be instanceof "StorageError", instead received "${e.constructor.name}" with message: "${e.message}"`, pass: false }
      }
      if (checkErrorType && e.code !== StorageError.codes.BadArgument) {
        return { message: () => `expected error code to be "BadArgument", instead received "${e.code}" with message: "${e.message}"`, pass: false }
      }
      const message = e.message.toLowerCase()
      for (let i = 0; i < args.length; ++i) {
        let a = args[i].toLowerCase()
        if (message.indexOf(a) < 0) {
          return { message: () => `expected error message "${message}" to contain "${a}"`, pass: false }
        }
      }
      return { pass: true }
    }
    return { message: () => 'function should have thrown', pass: false }
  }
})
