'use strict'

const mplex = require('pull-mplex')
const tcp = require('net')
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')

// Connect to the listener server
const connection = tcp.connect(9999, function () {
  // Create the muxer with the pull-stream converted socket connection
  const dialer = mplex.dialer(toPull.duplex(connection))

  // Create a new stream over the connection
  console.log('[dialer] opening stream')
  const stream = dialer.newStream((err) => {
    console.log('[dialer] opened stream')
    if (err) throw err
  })

  pull(
    pull.values(['hey, how is it going. I am the dialer']),
    stream
  )
})
