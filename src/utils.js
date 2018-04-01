'use strict'

const pull = require('pull-stream')
const varint = require('varint')
const lp = require('pull-length-prefixed')
const cat = require('pull-cat')
const through = require('pull-through')

exports.encodeMsg = (id, type, data, cb) => {
  return pull(
    cat([
      pull.values([varint.encode(id << 3 | type)]),
      pull(
        pull.values([Buffer.from(data)]),
        lp.encode()
      )
    ]),
    pull.flatten(),
    pull.collect((err, data) => {
      if (err) { return cb(err) }
      cb(null, Buffer.from(data))
    })
  )
}

exports.decodeMsg = (msg, cb) => {
  let h = null
  return pull(
    pull.values([msg]),
    through(function (buf) {
      const header = varint.decode(buf)
      h = { id: header >> 3, type: header & 7 }
      this.queue(buf.slice(varint.decode.bytes))
      this.queue(null)
    }),
    lp.decode(),
    pull.collect((err, data) => {
      if (err) { return cb(err) }
      cb(null, [h, data[0]])
    })
  )
}
