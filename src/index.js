'use strict'

const pushable = require('pull-pushable')

const EE = require('events')

const Channel = require('./channel')
const consts = require('./consts')
const utils = require('./utils')

class Mplex extends EE {
  constructor (initiator) {
    super()
    this._initiator = initiator || false
    this._chanId = this._initiator ? 0 : 1
    this._channels = {}
    this._chandata = pushable((err) => {
      setImmediate(() => this.emit('close'))
    })

    this.source = this._chandata

    this.sink = (read) => {
      const next = (end, data) => {
        if (end === true) { return }
        if (end) { return this.emit('error', end) }
        return this._handle(data, (err) => {
          read(err, next)
        })
      }

      read(null, next)
    }
  }

  end () {
    // propagate close to channels
    Object
      .keys(this._channels)
      .forEach((id) => {
        this._channels[id].end(end)
        delete this._channels[id]
      })
  }

  push (data) {
    this._chandata.push(data)
    // this._drain()
  }

  nextChanId (initiator) {
    let inc = 1
    if (initiator) { inc += 1 }
    this._chanId += inc + 1
    return this._chanId
  }

  newStream (name) {
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

    chan.once('end', () => {
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
          if (this._initiator && (id & 1) !== 1) {
            return this.emit(
              'error',
              new Error(`stream initiator can't have even ids`))
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
            chan.end()
          }
          return cb()
        }

        case consts.type.OUT_RESET:
        case consts.type.IN_RESET: {
          return cb()
        }
      }
    })
  }
}

module.exports = Mplex
