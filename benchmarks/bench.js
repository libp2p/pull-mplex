'use strict'

const minimist = require('minimist')
const bench = require('fastbench')
const net = require('net')
const childProcess = require('child_process')
const path = require('path')
const parallel = require('fastparallel')({
  results: false
})
const pull = require('pull-stream')
const toPull = require('stream-to-pull-stream')

const argv = minimist(process.argv.slice(2), {
  boolean: 'child',
  default: {
    child: true,
    port: 3000,
    host: 'localhost',
    lib: 'pull-mplex'
  }
})

function buildPingPong (cb) {
  let child
  let dialer
  const mplex = require(argv.lib || 'pull-mplex')

  if (argv.child) {
    child = childProcess.fork(path.join(__dirname, 'mplex-echo.js'), {
      stdio: 'inherit'
    })

    child.on('message', start)

    child.on('error', cb)

    child.on('exit', console.log)
  } else {
    start(argv)
  }

  function start (addr) {
    const client = net.connect(addr.port, addr.host)
    client.on('connect', function () {
      const connection = toPull.duplex(client)
      dialer = mplex.dialer(connection)
      cb(null, benchPingPong)
    })
  }

  const max = 1000
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

  var run = bench([benchPingPong], 100)

  // Do it 5 times
  times(5, run, function () {
    // close the sockets the bad way
    process.exit(0)
  })
})
