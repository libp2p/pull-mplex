'use strict'

const minimist = require('minimist')
const net = require('net')
const toPull = require('stream-to-pull-stream')
const pull = require('pull-stream')
let count = 0
let port

const server = net.createServer(handle)

const argv = minimist(process.argv.slice(2), {
  boolean: 'child',
  default: {
    child: true,
    port: 3000,
    host: 'localhost',
    lib: 'pull-mplex'
  }
})

const mplex = require(argv.lib || 'pull-mplex')

if (argv.child) {
  port = 0
} else {
  port = 3000
}

function handle (socket) {
  // Turn the socket into a duplex pull-stream
  const connection = toPull.duplex(socket)
  const listener = mplex.listener(connection)

  listener.on('stream', (stream) => {
    pull(
      stream,
      pull.map((v) => {
        count++
        return v
      }),
      stream
    )
  })
}

server.listen(port, function (err) {
  if (err) throw err

  if (argv.child) {
    process.send(server.address())
  } else {
    console.error('listening on', server.address().port)
  }
})

process.on('disconnect', function () {
  process.exit(0)
})

var signal = 'SIGINT'

// Cleanly shut down process on SIGTERM to ensure that perf-<pid>.map gets flushed
process.on(signal, onSignal)

function onSignal () {
  console.error('count', count)
  // IMPORTANT to log on stderr, to not clutter stdout which is purely for data, i.e. dtrace stacks
  console.error('Caught', signal, ', shutting down.')
  server.close()
  process.exit(0)
}
