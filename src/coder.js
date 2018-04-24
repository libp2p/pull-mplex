'use strict'

const varint = require('varint')
const through = require('pull-through')

const debug = require('debug')

const log = debug('pull-plex:coder')
log.err = debug('pull-plex:coder:err')

const PULL_LENGTH = 10 * 1024
const empty = Buffer.alloc(0)
exports.encode = () => {
  let pool = Buffer.alloc(PULL_LENGTH)
  let used = 0

  return through(function (msg) {
    const oldUsed = used
    varint.encode(msg[0] << 3 | msg[1], pool, used)
    used += varint.encode.bytes
    varint.encode(varint.encode(msg[2] ? msg[2].length : 0), pool, used)
    used += varint.encode.bytes
    this.queue(pool.slice(oldUsed, used)) // send header

    if (PULL_LENGTH - used < 100) {
      pool = Buffer.alloc(PULL_LENGTH)
      used = 0
    }

    this.queue(msg[2] || empty)
  })
}

const States = {
  PARSING: 0,
  READING: 1
}

exports.decode = () => {
  let state = States.PARSING
  let message = null
  let length = 0
  let buffer = null

  const tryDecode = (msg) => {
    let offset = 0
    let length = 0
    try {
      let h = varint.decode(msg)
      offset += varint.decode.bytes
      length = varint.decode(msg, offset)
      offset += varint.decode.bytes
      return [h, offset, length]
    } catch (err) {
      log.err(err) // ignore if data is empty
    }
    return []
  }

  const decode = (msg) => {
    const [h, offset, length] = tryDecode(msg)
    if (h !== void 0) {
      const message = {
        id: h >> 3,
        type: h & 7,
        data: [] // instead of allocating a new buff use a mem pool here
      }

      state = States.READING
      return [msg.slice(offset), message, length]
    }

    return [msg]
  }

  const read = (msg, data, length) => {
    if (length <= 0) {
      state = States.PARSING
      return [0, msg, data]
    }

    let left = length - msg.length
    if (left < 0) { left = 0 }
    if (msg.length > 0) {
      const buff = msg.slice(0, length - left)
      data.push(Buffer.isBuffer(buff) ? buff : Buffer.from(buff))
    }
    if (left <= 0) { state = States.PARSING }
    return [left, msg.slice(length - left), data]
  }

  return through(function (msg_) {
    let msg = msg_
    while (msg && msg.length) {
      if (States.PARSING === state) {
        if (!buffer) {
          buffer = Buffer.from(msg)
        } else {
          buffer = Buffer.concat([buffer, msg])
        }

        [msg, message, length] = decode(buffer)
        if (!message && !length) {
          return // read more
        }
        buffer = null
      }

      if (States.READING === state) {
        [length, msg, message.data] = read(msg, message.data, length)
        if (length <= 0 && States.PARSING === state) {
          message.data = Buffer.concat(message.data) // get new buffer
          this.queue(message)
          message = null
          length = 0
        }
      }
    }
  })
}
