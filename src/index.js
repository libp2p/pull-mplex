'use strict'

const pull = require('pull-stream')
const pushable = require('pull-pushable')
const through = require('pull-through')
const looper = require('looper')

const defautls = require('lodash.defaults')

const EE = require('events')

const Channel = require('./channel')
const consts = require('./consts')
const coder = require('./coder')

const debug = require('debug')

const log = debug('pull-plex')
log.err = debug('pull-plex:err')

const MAX_MSG_SIZE = 1 << 20 // 1mb

class Mplex extends EE {
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

    this._initiator = Boolean(opts.initiator)
    this._chanId = 0
    this._inChannels = new Array(this._maxChannels / 2)
    this._outChannels = new Array(this._maxChannels / 2)
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
      this._log('mplex ended')
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
        if (data && data.length >= self._maxMsgSize) {
          setImmediate(() => self.emit('error', new Error('message too large!')))
          return this.queue(null)
        }
        this.queue(data)
      }),
      coder.decode(),
      (read) => {
        const next = looper(() => {
          read(null, (end, data) => {
            if (self._endedLocal) { return }
            if (end === true) { return self.close() }
            if (end) { return self.reset(end) }
            self._handle(data)
            next()
          })
        })
        next()
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
    const chans = Array.prototype.concat(this._outChannels, this._inChannels)
    for (let chan of chans) {
      if (chan) {
        chan.close(err)
      }
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
    if (data.data &&
      Buffer.byteLength(data.data) > this._maxMsgSize) {
      this._chandata.end(new Error('message too large!'))
    }

    this._chandata.push(data)
  }

  createStream (name) {
    if (typeof name === 'number') { name = name.toString() }
    const chan = this._newStream(null, true, false, name, this._outChannels)
    if (!this._lazy) { chan.openChan(name) }
    return chan
  }

  _newStream (id, initiator, open, name, list) {
    if (this.chanSize >= this._maxChannels) {
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

    id = typeof id === 'number' ? id : this._chanId++
    if (list[id]) {
      this.emit('error', new Error(`channel with id ${id} already exist!`))
      return
    }
    const chan = new Channel({
      id,
      name,
      plex: this,
      initiator,
      open: open || false
    })

    return this._addChan(id, chan, list)
  }

  _addChan (id, chan, list) {
    chan.once('close', () => {
      list[id] = null
    })

    list[id] = chan
    return chan
  }

  get chanSize () {
    return this._inChannels.size + this._outChannels.size
  }

  _handle (msg) {
    this._log('_handle', msg)
    const { id, type, data } = msg
    switch (type) {
      case consts.type.NEW: {
        const chan = this._newStream(id, false, true, data.toString(), this._inChannels)
        setImmediate(() => this.emit('stream', chan, id))
        break
      }

      case consts.type.OUT_MESSAGE:
      case consts.type.IN_MESSAGE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.push(data)
        }
        break
      }

      case consts.type.OUT_CLOSE:
      case consts.type.IN_CLOSE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.close()
        }
        break
      }

      case consts.type.OUT_RESET:
      case consts.type.IN_RESET: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list[id]
        if (chan) {
          chan.reset()
        }
        break
      }

      default:
        this.emit('error', new Error('Invalid message type'))
    }
  }
}

module.exports = Mplex
