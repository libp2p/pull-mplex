'use strict'

const pushable = require('pull-pushable')

const consts = require('./consts')
const utils = require('./utils')
const EE = require('events')

const debug = require('debug')

const log = debug('pull-plex')
log.err = debug('pull-plex:err')

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
        src: 'channel.js',
        op: name,
        channel: this._name,
        id: this._id,
        endedLocal: this._endedLocal,
        endedRemote: this._endedRemote,
        initiator: this._initiator,
        data: data || ''
      })
    }

    this._log('new channel', this._name)

    this._msgs = pushable((err) => {
      this._log('source closed', err)
      if (this._reset) { return } // don't try closing the channel on reset
      this.endChan((err) => {
        if (err) { setImmediate(() => this.emit('error', err)) }
      })
    })

    this._source = this._msgs

    this.sink = (read) => {
      const next = (end, data) => {
        this._log('sink', data)

        // stream already ended
        if (this._endedLocal) { return }

        this._endedLocal = end || false

        // source ended, close the stream
        if (end === true) {
          this.endChan((err) => {
            if (err) {
              log.err(err)
              setImmediate(() => this.emit('error', err))
            }
          })
          return
        }

        // source errored, reset stream
        if (end || this._reset) {
          this.resetChan(() => {
            setImmediate(() => this.emit('error', end || this._reset))
            this.reset()
          })
          return
        }

        // just send
        return this.sendMsg(data, (err) => {
          read(err, next)
        })
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
  }

  // close for reading
  close (err) {
    this._log('close', err)
    this.emit('close', err)
    this._endedRemote = err || true
    this._msgs.end(err)
  }

  reset (err) {
    this._log('reset', err)
    this._reset = err || new Error('channel reset!')
    this.close(this._reset)
  }

  openChan (cb) {
    this._log('openChan')

    this.open = true // avoid duplicate open msgs
    utils.encodeMsg(this._id,
      consts.NEW,
      this._name,
      (err, data) => {
        if (err) {
          log.err(err)
          this.open = false
          return cb(err)
        }

        this._plex.push(data)
        cb(null, this)
      })
  }

  sendMsg (data, cb) {
    this._log('sendMsg', data)

    if (!this.open) {
      return this.openChan((err) => {
        if (err) {
          log.err(err)
          return cb(err)
        }

        this.sendMsg(data, cb)
      })
    }

    utils.encodeMsg(this._id,
      this._initiator
        ? consts.type.OUT_MESSAGE
        : consts.type.IN_MESSAGE,
      data,
      (err, data) => {
        if (err) {
          log.err(err)
          return cb(err)
        }

        this._plex.push(data)
        cb()
      })
  }

  endChan (cb) {
    this._log('endChan')

    if (!this.open) {
      return cb()
    }

    utils.encodeMsg(this._id,
      this._initiator
        ? consts.type.OUT_CLOSE
        : consts.type.IN_CLOSE,
      '',
      (err, data) => {
        if (err) {
          log.err(err)
          return cb(err)
        }
        this._plex.push(data)
        cb()
      })
  }

  resetChan (cb) {
    this._log('endChan')

    if (!this.open) {
      return cb()
    }

    utils.encodeMsg(this._id,
      this._initiator
        ? consts.type.OUT_RESET
        : consts.type.IN_RESET,
      '',
      (err, data) => {
        if (err) {
          log.err(err)
          return cb(err)
        }
        this._plex.push(data)
        cb()
      })
  }
}

module.exports = Channel
