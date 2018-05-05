'use strict'

const pushable = require('pull-pushable')
const defaults = require('lodash.defaults')
const looper = require('looper')

const consts = require('./consts')
const EE = require('events')

const debug = require('debug')

const log = debug('pull-plex:chan')
log.err = debug('pull-plex:chan:err')

class Channel extends EE {
  constructor (opts) {
    super()

    opts = defaults({}, opts, { initiator: false })

    this._id = opts.id
    this._name = opts.name
    this._plex = opts.plex
    this._open = opts.open
    this._initiator = opts.initiator
    this._endedRemote = false // remote stream ended
    this._endedLocal = false // local stream ended
    this._reset = false

    this.MSG = this._initiator
      ? consts.type.OUT_MESSAGE
      : consts.type.IN_MESSAGE

    this.END = this._initiator
      ? consts.type.OUT_CLOSE
      : consts.type.IN_CLOSE

    this.RESET = this._initiator
      ? consts.type.OUT_RESET
      : consts.type.IN_RESET

    this._log = (name, data) => {
      log({
        op: name,
        name: this._name,
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
      if (err && typeof err !== 'boolean') {
        setImmediate(() => this.emit('error', err))
      }
      // this.endChan() // TODO: do not uncomment this, it will end the channel too early
    })

    this._source = this._msgs

    this.sink = (read) => {
      const next = looper(() => {
        read(null, (end, data) => {
          // stream already ended
          if (this._endedLocal) { return }

          this._endedLocal = end || false

          // source ended, close the stream
          if (end === true) {
            return this.endChan()
          }

          // source errored, reset stream
          if (end || this._reset) {
            this.resetChan()
            this.emit('error', end || this._reset)
            this.reset()
            return
          }

          // just send
          this.sendMsg(data)
          next()
        })
      })

      next()
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

  get destroyed () {
    return this._endedRemote && this._endedLocal
  }

  push (data) {
    this._log('push', data)
    this._msgs.push(data)
  }

  // close for reading
  close (err) {
    this._log('close', err)
    if (!this._endedRemote) {
      this._endedRemote = err || true
      this._msgs.end(this._endedRemote)
      this.emit('close', err)
      this.plex = null
    }
  }

  reset (err) {
    this._log('reset', err)
    this._reset = err || 'channel reset!'
    this.close(this._reset)
  }

  openChan () {
    if (this.open) { return } // chan already open

    let name
    this.open = true
    this._plex.push([
      this._id,
      consts.type.NEW,
      name !== this._id.toString() ? name : null
    ])
  }

  sendMsg (data) {
    this._log('sendMsg')

    if (!this.open) {
      this.openChan()
    }

    this._plex.push([
      this._id,
      this.MSG,
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
      this.END
    ])
  }

  resetChan () {
    this._log('resetChan')

    if (!this.open) {
      return
    }

    this._plex.push([
      this._id,
      this.RESET
    ])
  }
}

module.exports = Channel
