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
    this._chanId = this._initiator ? 0 : 1
    this._inChannels = new Map()
    this._outChannels = new Map()
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
    const chans = new Map(this._outChannels, this._inChannels)
    for (let chan of chans.values()) {
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
    if (data.data &&
      Buffer.byteLength(data.data) > this._maxMsgSize) {
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
    const chan = this._newStream(null, true, false, name, this._outChannels)
    if (!this._lazy) { chan.openChan() }
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

    id = typeof id === 'number' ? id : this._nextChanId(initiator)
    if (list.has(id)) {
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
      const chan = list.get(id)
      // this._log('deleting channel', JSON.stringify({
      //   channel: this._name,
      //   id: id,
      //   endedLocal: chan._endedLocal,
      //   endedRemote: chan._endedRemote,
      //   initiator: chan._initiator
      // }))
      list.delete(id)
    })

    list.set(id, chan)
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
        return
      }

      case consts.type.OUT_MESSAGE:
      case consts.type.IN_MESSAGE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list.get(id)
        if (chan) {
          chan.push(data)
        }
        return
      }

      case consts.type.OUT_CLOSE:
      case consts.type.IN_CLOSE: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list.get(id)
        if (chan) {
          chan.close()
        }
        return
      }

      case consts.type.OUT_RESET:
      case consts.type.IN_RESET: {
        const list = type & 1 ? this._outChannels : this._inChannels
        const chan = list.get(id)
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

module.exports = Mplex
