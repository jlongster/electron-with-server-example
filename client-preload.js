const { contextBridge } = require('electron')

const opts = parseArgs(window.process.argv)
const socketId = opts.get('--socketId')

const ipc = require('node-ipc')
ipc.config.silent = true
ipc.config.appspace = opts.get('--socketAppspace')

contextBridge.exposeInMainWorld(
  'myapp',
  {
    uuid: require('uuid'),
    isDev: opts.get('--isDev'),
    appVersion: opts.get('--appVersion'),
    socketId,
    ipcOn,
    ipcEmit
  }
)
function ipcOn(id, handle) {
  ipc.connectTo(id, () => {
    ipc.of[id].on("message", handle.message)
    ipc.of[id].on("connect", handle.connect)
    ipc.of[id].on("disconnect", handle.disconnect)
  })
}

function ipcEmit(id, ...args) {
  return ipc.of[id].emit(...args)
}

function parseArgs(argv) {
  return argv.reduce((args, arg) => {
    const match = arg.split("=")
    args.set(match[0], match[1] || true)
    return args
  }, new Map())
}