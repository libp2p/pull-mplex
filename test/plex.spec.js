/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const pull = require('pull-stream')
const pair = require('pull-pair/duplex')
const pushable = require('pull-pushable')
const abortable = require('pull-abortable')

const Plex = require('../src')
const utils = require('../src/utils')
const consts = require('../src/consts')

const series = require('async/series')

describe('plex', () => {
  // it('should be writable', (done) => {
  //   const plex = new Plex(false)
  //
  //   plex.on('stream', (stream) => {
  //     pull(pull.values([Buffer.from('hellooooooooooooo')]), stream)
  //   })
  //
  //   utils.encodeMsg(3,
  //     consts.type.NEW,
  //     Buffer.from('chan1'),
  //     (err, msg) => {
  //       expect(err).to.not.exist()
  //       pull(
  //         pull.values([msg]),
  //         plex,
  //         pull.drain((_data) => {
  //           expect(err).to.not.exist()
  //           utils.decodeMsg(_data, (err, data) => {
  //             expect(err).to.not.exist()
  //             const { id, type } = data[0]
  //             expect(id).to.eql(3)
  //             expect(type).to.eql(consts.type.IN_MESSAGE)
  //             expect(data[1]).to.deep.eql(Buffer.from('hellooooooooooooo'))
  //             done()
  //           })
  //         })
  //       )
  //     })
  // })
  //
  // it('should be readable', (done) => {
  //   const plex = new Plex(true)
  //
  //   plex.on('stream', (stream) => {
  //     pull(
  //       stream,
  //       // drain, because otherwise we have to send an explicit close
  //       pull.drain((data) => {
  //         expect(data).to.deep.eql(Buffer.from('hellooooooooooooo'))
  //         done()
  //       })
  //     )
  //   })
  //
  //   series([
  //     (cb) => utils.encodeMsg(3,
  //       consts.type.NEW,
  //       Buffer.from('chan1'), cb),
  //     (cb) => utils.encodeMsg(3,
  //       consts.type.IN_MESSAGE,
  //       Buffer.from('hellooooooooooooo'),
  //       cb)
  //   ], (err, msgs) => {
  //     expect(err).to.not.exist()
  //     pull(
  //       pull.values(msgs),
  //       plex
  //     )
  //   })
  // })

  it(`channel id should be correct`, () => [1, 0].forEach((type) => {
    const initiator = Boolean(type)
    const plex = new Plex(initiator)

    const times = 10
    for (let i = 0; i < times; i++) {
      expect(Boolean(plex._nextChanId() & 1)).to.be.eql(initiator)
    }
  }))
})
