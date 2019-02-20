'use strict'

const path = require('path')
const minimist = require('minimist')
const bench = require('fastbench')
const net = require('net')

const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')
const pullFile = require('pull-file')

const { files } = require('./util')

let repeat
let runs

const argv = minimist(process.argv.slice(2), {
  boolean: 'child',
  default: {
    child: true,
    port: 3000,
    host: 'localhost',
    lib: 'pull-mplex',
    repeat: 1,
    runs: 3
  }
})

/**
 * Starts the needed servers, creates the connections and then
 * calls back with the benchmark function to execute
 * @param {function(function)} callback
 */
function buildSendFile (callback) {
  let dialer
  const mplex = require(argv.lib || 'pull-mplex')
  repeat = argv.repeat
  runs = argv.runs

  start(argv)

  function startServer (addr, cb) {
    const server = net.createServer(function (socket) {
      const connection = toPull.duplex(socket)
      const listener = mplex.listener(connection)

      listener.on('stream', (stream) => {
        pull(
          stream,
          stream
        )
      })
    })
    server.listen(addr.port, function (err) {
      if (err) throw err
      cb()
    })
  }

  function start (addr) {
    startServer(addr, function () {
      // Create the dialer
      dialer = net.connect(addr.port, addr.host)
      dialer.on('connect', function () {
        const connection = toPull.duplex(dialer)
        dialer = mplex.dialer(connection)
        callback(null, sendFile)
      })
    })
  }

  function sendFile (cb) {
    const stream = dialer.newStream((err) => {
      if (err) console.log(err)
    })

    const inputFile = path.join(__dirname, `/fixtures/${files[0].name}.txt`)

    pull(
      pullFile(inputFile, { bufferSize: 1 << 20 }),
      stream,
      pull.collect(cb)
    )
  }
}

function times (num, run, cb) {
  if (--num < 0) return cb()
  run(function (err) {
    if (err) throw err

    times(num, run, cb)
  })
}

buildSendFile(function (err, sendFile) {
  if (err) throw err

  // run sendFile `repeat` many times
  const run = bench([sendFile], repeat)

  // Do it `runs` many times
  times(runs, run, function () {
    // close the sockets the bad way
    process.exit(0)
  })
})
