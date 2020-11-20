// Import from "main world" context
const { ipcOn, ipcEmit, socketId } = window.myapp

// State
const replyHandlers = new Map()
const listeners = new Map()
let messageQueue = []
let connected = false

// Functions
ipcOn(socketId, {
  message: (data) => {
    const msg = JSON.parse(data)

    if (msg.type === 'error') {
      // Up to you whether or not to care about the error
      const { id } = msg
      replyHandlers.delete(id)
    } else if (msg.type === 'reply') {
      const { id, result } = msg

      const handler = replyHandlers.get(id)
      if (handler) {
        replyHandlers.delete(id)
        handler.resolve(result)
      }
    } else if (msg.type === 'push') {
      const { name, args } = msg

      const listens = listeners.get(name)
      if (listens) {
        listens.forEach(listener => {
          listener(args)
        })
      }
    } else {
      throw new Error('Unknown message type: ' + JSON.stringify(msg))
    }
  },

  connect: () => {
    connected = true

    // Send any messages that were queued while closed
    if (messageQueue.length > 0) {
      messageQueue.forEach(msg => client.emit('message', msg))
      messageQueue = []
    }

    // onOpen(client)
  },

  disconnect: () => {
    connected = false
  }
})

function send(name, args) {
  return new Promise((resolve, reject) => {
    let id = window.myapp.uuid.v4()
    replyHandlers.set(id, { resolve, reject })
    if (connected) {
      ipcEmit(socketId, 'message', JSON.stringify({ id, name, args }))
    } else {
      messageQueue.push(JSON.stringify({ id, name, args }))
    }
  })
}

function listen(name, cb) {
  if (!listeners.get(name)) {
    listeners.set(name, [])
  }
  listeners.get(name).push(cb)

  return () => {
    let arr = listeners.get(name)
    listeners.set(name, arr.filter(cb_ => cb_ !== cb))
  }
}

function unlisten(name) {
  listeners.set(name, [])
}
