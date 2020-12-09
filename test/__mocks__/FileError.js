
const codes = {
  ERROR_BAD_ARGUMENT: jest.fn(() => {
    console.log('this was called')
  })
}

const logAndThrow = jest.fn(() => {
  console.log('log and Throw was called') 
})

module.exports = {
  codes,
  messages: {},
  logAndThrow
}