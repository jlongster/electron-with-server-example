# electron-with-server-example

![](http://jlongster.com/s/upload/ef77cefd-5ba9-47cd-9ddc-0c13af66a9d5.png)

See [this post](https://jlongster.com/secret-of-good-electron-apps) for background. This project demonstrates how to use a background server in an Electron app. It creates a background process, an IPC mechanism to communicate with it, and does it all in the safest way possible.

This is exactly how my product [Actual](https://actualbudget.com/), a personal finance manager, works and this code is almost 100% copy and pasted from it.

You have to know a decent amount about Electron to set up a background process which is why I created this.

**Note: running a node process is dangerous.** If the node process gets compromised in any way and you haven't sandboxed your app (available on macOS and Windows), the attacker has full access to the OS. You need to avoid running untrusted JS at all costs if you are going to enable node anywhere in your app. Be careful. This is meant to be used with 100% local apps where even the frontend is pulled from local files, not from a webserver.

## Running

```
$ yarn install
$ yarn start
```

All `yarn start` does is run `electron .` which starts your electron app for development. Note how the background server runs in a window in development for debugging, but if you packaged it up with something like [`electron-builder`](https://www.electron.build/) it would run as a normal node process in the background.

## How it works

Electron has two types of processes: a renderer process which represents a page with UI and a main process which handles all the renderers. It provides an IPC (inter-process communication) channel for sending messages between a main and renderer process, but you *really* want to be careful using it. Electron's IPC is used for anything critical like interacting with menus, coordinating renders, and more. If you block it, you will quickly see performance degradation (I think recent version have mitigated this possibility somewhat).

A naive implementation of a backend process would be something like this:

```
renderer (client) <----> main <----> renderer (backend)
```

Create a second renderer process and communicate with the client by sending messages through the main process. But you *really* don't want to be clogging Electron's IPC, and it seems wasteful to go through the main process when you just want to talk to the client.

See [an article](https://medium.com/actualbudget/the-horror-of-blocking-electrons-main-process-351bf11a763c) in 2018 about blocking the main process, and [this github issue](https://github.com/electron/electron/issues/12098). Supposedly in version 5 the main process doesn't block the renderer as much, but you still want to avoid it as much as possible.

Lastly, it's weird to create a renderer process when all you want is to run some node code. Sure, you can create a *hidden window* but surely there's overhead with that? Luckily, there's a way to create a normal node process!

### Creating a node process from Electron

If you fork electron's process **it creates a node process**. That's all you have to do. (see [this issue](https://github.com/electron/electron/issues/6656)). The following code runs `server.js` as a normal node process:

```js
let { fork } = require('child_process')
let serverProcess = fork(__dirname + '/server.js')
```

Great! So now we have the backend as node process:

```
renderer (client) <----> main <----> node (backend)
```

You can communicate to it like you would a normal subprocess in node. However, we'd still like to avoid the dependency on the main process...

### node-ipc

The solution is creating your own IPC mechanism. I used [node-ipc](https://www.npmjs.com/package/node-ipc) which works well. That will create a local socket that the client and server uses to talk directly with each other.

So even though the main process is controlling 2 renderer processes, the communication now happens directly:

```
renderer (client) <----> main <----> node (backend)
    ^                                   ^
    |_________(your socket)_____________|
```

node-ipc will create a unix domain socket (or the equivalent on Windows) which is more performant than a WebSocket because it doesn't have network and messaging overhead.

The IPC implementation can be seen in [client-ipc.js](https://github.com/jlongster/electron-with-server-example/blob/master/client-ipc.js) and [server-ipc.js](https://github.com/jlongster/electron-with-server-example/blob/master/server-ipc.js).

It finds an available socket but [trying to connect](https://github.com/jlongster/electron-with-server-example/blob/master/find-open-socket.js) and making sure nothing is currently running (this way multiple instances of the app can run at once). Then it passes the socket name to the server process [as an argument](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/index.js#L54), and passes it to the client by [posting a message](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/index.js#L44) once the window is ready.

The server starts up an IPC server, and the client connects to it. Now they can directly communicate with each other.

### Exposing node-ipc to the client

The client window is created with [`nodeIntegration` disabled](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/index.js#L16). This means it's a normal web page, but how can it access the `node-ipc` library then?

The answer is passing the [`preload` option](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/index.js#L17) to run [client-preload.js](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/client-preload.js) as the preload file. Electron will run this special file with node enabled when renderer process is created, allowing you to expose specific thing to the window. We expose an `ipcConnect` method to access the IPC and a few other things.

**This can be dangerous**. If you are loading untrusted JS in the page, don't do this. You are exposing objects onto the page that have access to full node capabilities, and attackers can potentially abuse JavaScript to inject malicious code that will run in this scope. This goes for *anything* created from a preload file, not just this technique.

One mitigation is the `contextIsolation` option of the [BrowserWindow settings](https://electronjs.org/docs/api/browser-window#new-browserwindowoptions). It will run the preload file in a separate JS context, but unfortunately I can't figure out how to expose anything to the renderer's window with it on. If you want to expose stuff, you might be stuck with a dangerous preload, so you can't do this in apps that require untrusted JS.

### Server methods

Once the backend process is created and the IPC connection is established, the client can invoke server methods via the `send` method:

```js
let result = await send('make-factorial', { num: 2 })
```

The backend implements all its methods in [server-handlers.js](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/server-handlers.js). This file exports a simple object that you can add any methods to, like this:

```js
handlers['make-factorial'] = async ({ num }) => {
  console.log('making factorial')
  return num * 2
}
```

The internal mechanism for how messages are handled on the server/client can be seen in[client-ipc.js](https://github.com/jlongster/electron-with-server-example/blob/master/client-ipc.js) and [server-ipc.js](https://github.com/jlongster/electron-with-server-example/blob/master/server-ipc.js).

### Debug mode

The last trick is enabling faster development. Right now Electron owns the node process, so one technique would be to simply run the server in your own node process like `node server.js` and then edit the Electron code to only create the client. This is certainly a valid option!

You can then restart the server as much as you like, and pass any debug node flags to the process.

However, managing multiple processes is annoying. It's also annoying if you want to debug the node process to create the devtools inspector and handle all that.

We have the devtools in Electron, why don't we just use that? In dev mode, this project [loads the server in a background window](https://github.com/jlongster/electron-with-server-example/blob/ce2905cb9f018a81db83db193dbd7fd24fb77390/index.js#L67-L71) instead of a background process! It's easy to do since we just create a renderer process with node integration enabled, so all of node is still there, but we also get a window!

![](http://jlongster.com/s/upload/10fe1c47-44c1-4f5f-bb27-9b1223dba44d.png)

In production mode, it creates a normal node process in the background.

Now you can use the fancy console, debugger, and stellar performance
tools on your backend easily. You can even restart the server by simply reloading the window - and the renderer process doesn't even have to restart.

See [this post](https://jlongster.com/secret-of-good-electron-apps) for more examples of the cool stuff you can do with this.
