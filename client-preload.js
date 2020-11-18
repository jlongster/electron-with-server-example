const ipc = require('node-ipc')

const opts = parseArgs(window.process.argv)

window.uuid = require('uuid')
window.isDev = opts.get('--isDev')
window.appVersion = opts.get('--appVersion')

ipc.config.silent = true
ipc.config.appspace = opts.get('--socketAppspace')
window.socketId = opts.get('--socketId')
window.ipcConnect = (id, cb) => ipc.connectTo(id, () => cb(ipc.of[window.socketId]))

function parseArgs(argv) {
  return argv.reduce((args, arg) => {
    const match = arg.split("=")
    args.set(match[0], match[1] || true)
    return args
  }, new Map())
}