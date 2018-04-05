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

exports.decode = () => {
  const decode = (msg) => {
    let offset = 0
    const h = varint.decode(msg)
    offset += varint.decode.bytes
    let length
    let data
    try {
      length = varint.decode(msg, offset)
      offset += varint.decode.bytes

      if (length > msg.length) {
        throw new Error('partial buffer, need more data')
      }

      data = msg.slice(offset, offset + length)
    } catch (err) {
      log.err(err)
    } // ignore if data is empty

    const decoded = {
      id: h >> 3,
      type: h & 7,
      data
    }

    return [msg.slice(offset + length), decoded]
  }

  return through(function (msg) {
    let offset = 0
    let decoded
    while (msg.length) {
      [msg, decoded] = decode(msg)
      this.queue(decoded)
    }
  })
}
