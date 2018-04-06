'use strict'

const pull = require('pull-stream')
const varint = require('varint')
const lp = require('pull-length-prefixed')
const cat = require('pull-cat')
const through = require('pull-through')

const debug = require('debug')

const log = debug('pull-plex:utils')
log.err = debug('pull-plex:utils:err')

exports.encode = () => {
  return pull(
    through(function (msg) {
      const seq = [Buffer.from(varint.encode(msg[0] << 3 | msg[1]))]

      if (msg[2]) {
        seq.push(Buffer.from(varint.encode(Buffer.byteLength(msg[2]))))
        seq.push(Buffer.from(msg[2]))
      } else {
        seq.push(Buffer.from(varint.encode(0)))
      }

      this.queue(Buffer.concat(seq))
    })
  )
}

let States = {
  PARSING: 0,
  READING: 1
}
let state = States.PARSING
exports.decode = () => {
  const decode = (msg) => {
    let offset = 0
    const h = varint.decode(msg)
    offset += varint.decode.bytes
    let length, data
    try {
      length = varint.decode(msg, offset)
      offset += varint.decode.bytes
    } catch (err) {
      log.err(err) // ignore if data is empty
    }

    const message = {
      id: h >> 3,
      type: h & 7,
      data: Buffer.alloc(length) // instead of allocating a new buff use a mem pool here
    }

    state = States.READING
    return [msg.slice(offset), message, length]
  }

  const read = (msg, data, length) => {
    let left = length - msg.length
    if (msg.length > 0) {
      const buff = left > 0 ? msg.slice() : msg.slice(0, length)
      buff.copy(data)
      msg = msg.slice(buff.length)
    }
    if (left <= 0) { state = States.PARSING }
    return [left, msg, data]
  }

  let offset = 0
  let message = {}
  let length = 0
  return through(function (msg) {
    while (msg.length) {
      if (States.PARSING === state) {
        [msg, message, length] = decode(msg)
      }

      if (States.READING === state) {
        [length, msg, message.data] = read(msg, message.data, length)
        if (length <= 0 && States.PARSING === state) {
          this.queue(message)
          offset = 0
          message = {}
          length = 0
        }
      }
    }
  })
}
