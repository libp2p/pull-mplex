'use strict'

const minimist = require('minimist')
const bench = require('fastbench')
const net = require('net')
const parallel = require('fastparallel')({
  results: false
})
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')

let repeat
let runs
let max

const argv = minimist(process.argv.slice(2), {
  boolean: 'child',
  default: {
    child: true,
    port: 3000,
    host: 'localhost',
    lib: 'pull-mplex',
    sends: 1000,
    repeat: 100,
    runs: 3
  }
})

/**
 * Starts the needed servers, creates the connections and then
 * calls back with the benchmark function to execute
 * @param {function(function)} callback
 */
function buildPingPong (callback) {
  let dialer
  const mplex = require(argv.lib || 'pull-mplex')
  repeat = argv.repeat
  runs = argv.runs
  max = argv.sends

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
        callback(null, benchPingPong)
      })
    })
  }

  let functions = new Array(max)

  for (let i = 0; i < max; i++) {
    functions[i] = sendEcho
  }

  function benchPingPong (cb) {
    parallel(null, functions, null, cb)
  }

  function sendEcho (cb) {
    const stream = dialer.newStream((err) => {
      if (err) console.log(err)
    })

    pull(
      pull.values(['ping']),
      stream,
      pull.onEnd(cb)
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

buildPingPong(function (err, benchPingPong) {
  if (err) throw err

  // run benchPingPong `repeat` many times
  const run = bench([benchPingPong], repeat)

  // Do it `runs` many times
  times(runs, run, function () {
    // close the sockets the bad way
    process.exit(0)
  })
})
