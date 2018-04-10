'use strict'

const pull = require('pull-stream')
const pushable = require('pull-pushable')
const through = require('pull-through')

const defautls = require('lodash.defaults')

const EE = require('events')

const Channel = require('./channel')
const consts = require('./consts')
const coder = require('./coder')

const debug = require('debug')

const log = debug('pull-plex')
log.err = debug('pull-plex:err')

const MAX_MSG_SIZE = 1024 * 1024 // 1mb

class Plex extends EE {
  constructor (opts) {
    super()

    if (typeof opts === 'boolean') {
      opts = { initiator: opts }
    }

    opts = defautls({}, opts, {
      initiator: true,
      onChan: null,
      maxChannels: 10000,
      maxMsgSize: MAX_MSG_SIZE,
      lazy: false
    })

    this._maxChannels = opts.maxChannels
    this._maxMsgSize = opts.maxMsgSize
    this._lazy = opts.lazy

    this._initiator = !!opts.initiator
    this._chanId = this._initiator ? 1 : 0
    this._channels = new Map()
    this._endedRemote = false // remote stream ended
    this._endedLocal = false // local stream ended

    this._log = (name, data) => {
      log({
        op: name,
        initiator: this._initiator,
        endedLocal: this._endedLocal,
        endedRemote: this._endedRemote,
        data: (data && data.toString()) || ''
      })
    }

    this._chandata = pushable((err) => {
      this._log('chandata ended')
      this._endedRemote = true
      this.close(err)
    })

    if (opts.onChan) {
      this.on('stream', (chan) => opts.onChan(chan, chan.id))
    }

    this.source = pull(
      this._chandata,
      coder.encode()
    )

    const self = this
    this.sink = pull(
      through(function (data) {
        if (Buffer.byteLength(data) > self._maxMsgSize) {
          setImmediate(() => self.emit('error', new Error('message too large!')))
          return this.queue(null)
        }
        this.queue(data)
      }),
      coder.decode(),
      (read) => {
        const next = (end, data) => {
          if (this._endedLocal) { return }
          if (end === true) { return this.close() }
          if (end) { return this.reset(end) }
          this._handle(data)
          return read(null, next)
        }

        read(null, next)
      })
  }

  get initiator () {
    return this._initiator
  }

  close (err) {
    this._log('close', err)

    if (this.destroyed) { return }

    if (err) {
      setImmediate(() => this.emit('error', err))
    }

    err = err || 'Underlying stream has been closed'
    this._endedLocal = true

    // propagate close to channels
    for (let chan of this._channels.values()) {
      chan.close(err)
    }

    this.emit('close')
  }

  get destroyed () {
    return this._endedRemote && this._endedLocal
  }

  reset (err) {
    err = err || new Error('Underlying stream has been closed')
    this._chandata.end(err)
    this.close(err)
  }

  push (data) {
    this._log('push', data)
    if (data.data
      && Buffer.byteLength(data.data) > this._maxMsgSize) {
      this._chandata.end(new Error('message too large!'))
    }

    this._chandata.push(data)
    log('buffer', this._chandata.buffer)
  }

  _nextChanId () {
    const id = this._chanId
    this._chanId += 2
    return id
  }

  createStream (name) {
    if (typeof name === 'number') { name = name.toString() }
    const chan = this._newStream(null, this._initiator, false, name)
    if (!this._lazy) { chan.openChan() }
    return chan
  }

  _newStream (id, initiator, open, name) {
    this._log('_newStream', Array.prototype.slice.call(arguments))

    if (this._channels.size >= this._maxChannels) {
      this.emit('error', new Error('max channels exceeded'))
      return
    }

    if (typeof initiator === 'string') {
      name = initiator
      initiator = false
      open = false
    }

    if (typeof open === 'string') {
      name = open
      open = false
    }

    id = typeof id === 'number' ? id : this._nextChanId(initiator)
    const chan = new Channel({
      id,
      name,
      plex: this,
      initiator,
      open: open || false
    })

    chan.once('close', () => {
      const chan = this._channels.get(id)
      this._log('deleting channel', JSON.stringify({
        channel: this._name,
        id: id,
        endedLocal: chan._endedLocal,
        endedRemote: chan._endedRemote,
        initiator: chan._initiator
      }))
      this._channels.delete(id)
    })

    if (this._channels.has(id)) {
      this.emit('error', new Error(`channel with id ${id} already exist!`))
      return
    }

    this._channels.set(id, chan)
    return chan
  }

  _handle (msg) {
    this._log('_handle', msg)
    const { id, type, data } = msg
    switch (type) {
      case consts.type.NEW: {
        const chan = this._newStream(id, this._initiator, true, data.toString())
        setImmediate(() => this.emit('stream', chan, id))
        return
      }

      case consts.type.OUT_MESSAGE:
      case consts.type.IN_MESSAGE: {
        const chan = this._channels.get(id)
        if (chan) {
          chan.push(data)
        }
        return
      }

      case consts.type.OUT_CLOSE:
      case consts.type.IN_CLOSE: {
        const chan = this._channels.get(id)
        if (chan) {
          chan.close()
        }
        return
      }

      case consts.type.OUT_RESET:
      case consts.type.IN_RESET: {
        const chan = this._channels.get(id)
        if (chan) {
          chan.reset()
        }
        return
      }

      default:
        this.emit('error', new Error('Invalid message type'))
    }
  }
}

module.exports = Plex
