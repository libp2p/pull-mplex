'use strict'

const pull = require('pull-stream')
const varint = require('varint')
const through = require('pull-through')

const debug = require('debug')

const log = debug('pull-plex:utils')
log.err = debug('pull-plex:utils:err')

exports.encode = () => {
  return pull(
    through(function (msg) {
      const seq = [Buffer.from(varint.encode(msg[0] << 3 | msg[1]))]
      const len = msg[2] ? Buffer.byteLength(msg[2]) : 0
      seq.push(Buffer.from(varint.encode(len))) // send empty body
      this.queue(Buffer.concat(seq)) // send header

      if (len) {
        this.queue(msg[2])
      }
    })
  )
}

let States = {
  PARSING: 0,
  READING: 1
}

exports.decode = () => {
  let state = States.PARSING
  let offset = 0
  let message = null
  let length = 0
  let buffer = null
  let pos = 0
  
  const decode = (msg) => {
    try {
      let offset = 0
      let length = 0
      const h = varint.decode(msg)
      offset += varint.decode.bytes
      length = varint.decode(msg, offset)
      offset += varint.decode.bytes
      const message = {
        id: h >> 3,
        type: h & 7,
        data: Buffer.alloc(length) // instead of allocating a new buff use a mem pool here
      }

      state = States.READING
      return [msg.slice(offset), message, length]
    } catch (err) {
      log.err(err) // ignore if data is empty
      return [msg, undefined, undefined]
    }
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
      pos += buff.copy(data, pos)
      msg = msg.slice(buff.length)
    }
    if (left <= 0) { state = States.PARSING }
    return [left, msg, data]
  }

  return through(function (msg) {
    while (msg.length) {
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
          this.queue(message)
          offset = 0
          message = null
          length = 0
          pos = 0
        }
      }
    }
  })
}
