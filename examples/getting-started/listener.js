'use strict'

const mplex = require('pull-mplex')
const tcp = require('net')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const { PORT } = require('./constants')

const server = tcp.createServer((socket) => {
  console.log('[listener] Got connection!')

  // Turn the socket into a duplex pull-stream
  const connection = toPull.duplex(socket)
  const listener = mplex.listener(connection)

  listener.on('stream', (stream) => {
    console.log('[listener] Got stream!')
    pull(
      stream,
      pull.drain((data) => {
        console.log('[listener] Received:', data.toString())
      })
    )
  })
})

server.listen(PORT, () => {
  console.log(`[listener] listening on ${PORT}`)
})
