'use strict'

const varint = require('varint')
const through = require('pull-through')

const debug = require('debug')

const log = debug('pull-plex:coder')
log.err = debug('pull-plex:coder:err')

const PULL_LENGTH = 10 * 1024
const empty = Buffer.alloc(0)
let pool = Buffer.alloc(PULL_LENGTH)
let used = 0

exports.encode = () => {
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
        data: []
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
    const size = length - left
    if (msg.length > 0) {
      const buff = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
      data.push(buff.slice(0, size))
    }
    if (left <= 0) { state = States.PARSING }
    return [left, msg.slice(size), data]
  }

  let length = 0
  let offset = 0
  let used = 0
  let marker = 0
  let message = null
  let accumulating = false
  let buffer = Buffer.alloc(1 << 20)
  return through(function (msg) {
    while (msg && msg.length) {
      if (States.PARSING === state) {
        if (accumulating) {
          used += msg.copy(buffer, used)
          msg = buffer.slice(marker, used)
        }

        [msg, message, length] = decode(msg)
        if (!message) {
          if (!accumulating) {
            marker = used
            used += msg.copy(buffer, used)
          }
          accumulating = true
          return
        }

        used = 0
        marker = 0
        offset = 0
        accumulating = false
      }

      if (States.READING === state) {
        [length, msg, message.data] = read(msg, message.data, length)
        if (length <= 0 && States.PARSING === state) {
          message.data = message.data.length
            ? message.data.length === 1
              ? message.data[0]
              : Buffer.concat(message.data)
            : empty // get new buffer
          this.queue(message)
          message = null
          length = 0
        }
      }
    }
  })
}
