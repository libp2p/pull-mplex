'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection
const nextTick = require('async/nextTick')
const debug = require('debug')

const MULTIPLEX_CODEC = require('./codec')

const log = debug('libp2p-mplex:muxer')
log.err = debug('libp2p-mplex:muxer:error')

function noop () {}

class MultiplexMuxer extends EventEmitter {
  constructor (conn, multiplex) {
    super()
    this.conn = conn
    this.multiplex = multiplex
    this.multicodec = MULTIPLEX_CODEC

    multiplex.on('close', () => this.emit('close'))
    multiplex.on('error', (err) => this.emit('error', err))

    multiplex.on('stream', (stream) => {
      // install default error handler so that it doesn't throw
      stream.on('error', (err) => {
        log.err('receiver stream errored', err)
      })
      this.emit('stream', new Connection(stream, this.conn))
    })
  }

  // method added to enable pure stream muxer feeling
  newStream (callback) {
    callback = callback || noop
    let stream = this.multiplex.createStream()
    // install default error handler so that it doesn't throw
    stream.on('error', (err) => {
      log.err('initiator stream errored', err)
    })
    const conn = new Connection(stream, this.conn)
    nextTick(callback, null, conn)
    return conn
  }

  end (callback) {
    callback = callback || noop
    this.multiplex.once('close', callback)
    this.multiplex.close()
  }
}

module.exports = MultiplexMuxer
