'use strict'

const pushable = require('pull-pushable')

const consts = require('./consts')
const EE = require('events')

const debug = require('debug')

const log = debug('pull-plex:chan')
log.err = debug('pull-plex:chan:err')

class Channel extends EE {
  constructor (id, name, plex, initiator, open) {
    super()
    this._id = id
    this._name = name || this._id.toString()
    this._plex = plex
    this._open = open
    this._initiator = initiator
    this._endedRemote = false // remote stream ended
    this._endedLocal = false // local stream ended
    this._reset = false

    this._log = (name, data) => {
      log({
        op: name,
        channel: this._name,
        id: this._id,
        endedLocal: this._endedLocal,
        endedRemote: this._endedRemote,
        initiator: this._initiator,
        data: (data && data.toString()) || ''
      })
    }

    this._log('new channel', this._name)

    this._msgs = pushable((err) => {
      this._log('source closed', err)
      if (this._reset) { return } // don't try closing the channel on reset
      if (err) { setImmediate(() => this.emit('error', err)) }

      this.endChan()
    })

    this._source = this._msgs

    this.sink = (read) => {
      const next = (end, data) => {
        this._log('sink', data)

        // stream already ended
        if (this._endedLocal) { return }

        this._endedLocal = end || false

        // source ended, close the stream
        if (end === true) { return this.endChan() }

        // source errored, reset stream
        if (end || this._reset) {
          this.resetChan()
          this.emit('error', end || this._reset)
          this.reset()
          return
        }

        // just send
        this.sendMsg(data)
        return read(null, next)
      }

      read(null, next)
    }
  }

  get source () {
    return this._source
  }

  get id () {
    return this._id
  }

  get open () {
    return this._open
  }

  set open (open) {
    this._open = open
  }

  get name () {
    return this._name
  }

  push (data) {
    this._log('push', data)
    this._msgs.push(data)
    log('buffer', this._msgs.buffer)
  }

  // close for reading
  close (err) {
    this._log('close', err)
    this.emit('close', err)
    this._endedRemote = err
    this._msgs.end(this._endedRemote)
  }

  reset (err) {
    this._log('reset', err)
    this._reset = err || 'channel reset!'
    this.close(this._reset)
  }

  openChan () {
    this._log('openChan')

    this.open = true
    this._plex.push([
      this._id,
      consts.type.NEW,
      this._name
    ])
  }

  sendMsg (data) {
    this._log('sendMsg', data)

    if (!this.open) {
      this.openChan()
    }

    this._plex.push([
      this._id,
      this._initiator
        ? consts.type.IN_MESSAGE
        : consts.type.OUT_MESSAGE,
      data
    ])
  }

  endChan () {
    this._log('endChan')

    if (!this.open) {
      return
    }

    this._plex.push([
      this._id,
      this._initiator
        ? consts.type.IN_CLOSE
        : consts.type.OUT_CLOSE
    ])
  }

  resetChan () {
    this._log('endChan')

    if (!this.open) {
      return
    }

    this._plex.push([
      this._id,
      this._initiator
        ? consts.type.IN_RESET
        : consts.type.OUT_RESET
    ])
  }
}

module.exports = Channel
