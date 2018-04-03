'use strict'

const pull = require('pull-stream')
const varint = require('varint')
const lp = require('pull-length-prefixed')
const cat = require('pull-cat')
const through = require('pull-through')

exports.encode = () => {
  return through(function (msg) {
    const data = Buffer.concat([
      Buffer.from(varint.encode(msg[0] << 3 | msg[1])),
      Buffer.from(varint.encode(Buffer.byteLength(msg[2]))),
      Buffer.from(msg[2])
    ])
    this.queue(data)
  })
}

exports.decode = () => {
  return through(function (msg) {
    let offset = 0
    const h = varint.decode(msg)
    offset += varint.decode.bytes
    const length = varint.decode(msg.slice(offset))
    offset += varint.decode.bytes
    const decoded = {
      id: h >> 3,
      type: h & 7,
      data: msg.slice(offset /*, length*/) // somehow length gets offset and truncates the buffer
    }

    this.queue(decoded)
  })
}
