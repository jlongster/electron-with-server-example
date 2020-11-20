const { app, BrowserWindow } = require('electron')
const { fork } = require('child_process')
const isDev = require('electron-is-dev')
const fs = require('fs')

let clientWin
let serverWin
let serverProcess

function createWindow(args) {
  clientWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: args,
      preload: __dirname + '/client-preload.js'
    }
  })

  clientWin.loadFile('client-index.html')
}

function createBackgroundWindow(args) {
  const win = new BrowserWindow({
    x: 500,
    y: 300,
    width: 700,
    height: 500,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      additionalArguments: args,
    }
  })
  win.loadURL(`file://${__dirname}/server-dev.html`)

  serverWin = win
}

function createBackgroundProcess(args) {
  serverProcess = fork(__dirname + '/server.js', ['--subprocess', ...args])
  serverProcess.on('message', msg => { console.log("index", msg) })
}

const socketAppspace = `myapp.${process.pid}.`
const socketId = "server"

app.on('ready', async () => {
  const args = [
    `--appVersion=${app.getVersion()}`,
    `--socketAppspace=${socketAppspace}`,
    `--socketId=server`,
  ]
  if (isDev) args.push("--isDev")

  createWindow(args)

  if (isDev) {
    createBackgroundWindow(args)
  } else {
    createBackgroundProcess(args)
  }
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  // cleanup: remove socket after use
  const socketPath = `/tmp/${socketAppspace}${socketId}`
  fs.unlinkSync(socketPath)
})
