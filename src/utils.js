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
  return pull(
    cat([
      pull(
        pull.values([msg.slice(0, 1)]),
        through(function (h) {
          const header = varint.decode(h)
          this.queue({ id: header >> 3, type: header & 7 })
        })
      ),
      pull(
        pull.values([msg.slice(1)]),
        lp.decode()
      )
    ]),
    pull.collect((err, data) => {
      if (err) { return cb(err) }
      cb(null, data)
    })
  )
}
