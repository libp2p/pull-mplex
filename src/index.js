'use strict'

const pushable = require('pull-pushable')

const EE = require('events')

const Channel = require('./channel')
const consts = require('./consts')
const utils = require('./utils')

const debug = require('debug')

const log = debug('pull-plex')
log.err = debug('pull-plex:err')

class Mplex extends EE {
  constructor (initiator, onChan) {
    super()
    this._initiator = initiator || true
    this._chanId = 1
    this._channels = {}

    this._log = (name, data) => {
      log({
        src: 'channel.js',
        op: name,
        channel: this._name,
        id: this._id,
        localEnded: this._endedLocal,
        remoteEnded: this._endedRemote,
        initiator: this._initiator,
        data: data || ''
      })
    }

    this._chandata = pushable((err) => {
      this.destroy(err || new Error('Underlying stream has been closed'))
    })

    if (onChan) {
      this.on('stream', (chan) => onChan(chan, chan.id))
    }

    this.source = this._chandata

    this.sink = (read) => {
      const next = (end, data) => {
        if (end === true) { return }
        if (end) { return this.destroy(end) }
        return this._handle(data, (err) => {
          read(err, next)
        })
      }

      read(null, next)
    }
  }

  destroy (err) {
    // propagate close to channels
    Object
      .keys(this._channels)
      .forEach((id) => {
        const chan = this._channels[id]
        chan.close(err)
        delete this._channels[id]
      })

    if (err) {
      return setImmediate(() => this.emit('error', err))
    }

    this.emit('close')
  }

  push (data) {
    this._chandata.push(data)
  }

  nextChanId (initiator) {
    let inc = 1
    if (initiator) { inc = 1 }
    this._chanId += inc + 1

    return this._chanId
  }

  createStream (name) {
    return this._newStream(null, this._initiator, false, name)
  }

  _newStream (id, initiator, open, name) {
    if (typeof initiator === 'string') {
      name = initiator
      initiator = false
      open = false
    }

    if (typeof open === 'string') {
      name = open
      open = false
    }

    id = id || this.nextChanId(initiator)
    const chan = new Channel(id,
      name || id.toString(),
      this,
      initiator,
      open || false)

    chan.once('close', () => {
      delete this._channels[id]
    })

    this._channels[id] = chan
    return chan
  }

  _handle (msg, cb) {
    utils.decodeMsg(msg, (err, _data) => {
      if (err) { return cb(err) }
      const { id, type } = _data[0]
      const data = _data[1]
      switch (type) {
        case consts.type.NEW: {
          if (!this._initiator && (id & 1) !== 1) {
            return this.emit('error',
              new Error(`Initiator can't have even id's!`))
          }

          const chan = this._newStream(id, this._initiator, true, data.toString())
          setImmediate(() => this.emit('stream', chan))
          return cb()
        }

        case consts.type.OUT_MESSAGE:
        case consts.type.IN_MESSAGE: {
          const chan = this._channels[id]
          if (chan) {
            chan.push(data)
          }
          return cb()
        }

        case consts.type.OUT_CLOSE:
        case consts.type.IN_CLOSE: {
          const chan = this._channels[id]
          if (chan) {
            chan.close()
          }
          return cb()
        }

        case consts.type.OUT_RESET:
        case consts.type.IN_RESET: {
          const chan = this._channels[id]
          if (chan) {
            chan.reset()
          }
          return cb()
        }
      }
    })
  }
}

module.exports = Mplex
