let handlers = {}

handlers['make-factorial'] = async ({ num }) => {
  console.log('making factorial')
  return num * 2
}

handlers['ring-ring'] = async () => {
  console.log('picking up the phone')
  return 'hello!'
}

module.exports = handlers
