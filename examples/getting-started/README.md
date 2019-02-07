Getting Started
============

This example contains a simplex dialer/listener setup. The listener will start a server and listen for new streams. Any data it receives from those streams will be printed to the console. The dialer will connect to the listener and send it a single message.

## Install
```sh
$ npm install
```

## Run

1. Start the listener `node listener.js`.
2. In a new tab, start the dialer `node dialer.js`.

In the dialer tab you should see:
```log
[dialer] opening stream
[dialer] opened stream
```

In the listener tab you should see:
```log
[listener] listening on 9999
[listener] Got connection!
[listener] Got stream!
[listener] Received: hey, how is it going. I am the dialer
```
