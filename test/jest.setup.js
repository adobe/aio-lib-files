expect.extend({
  async toThrowWithMessageContaining (received, args) {
    try {
      await received()
    } catch (e) {
      if (typeof args === 'string') args = [args]
      const message = e.message.toLowerCase()
      for (let i = 0; i < args.length; ++i) {
        let a = args[i].toLowerCase()
        if (message.indexOf(a) < 0) {
          return { message: () => `expected "${message}" to contain "${a}"`, pass: false }
        }
      }
      return { pass: true }
    }
    return { message: () => 'function should have thrown', pass: false }
  }
})
