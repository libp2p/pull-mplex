/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const pull = require('pull-stream')
const pair = require('pull-pair/duplex')

const Mplex = require('../src')
const utils = require('../src/utils')
const consts = require('../src/consts')

const series = require('async/series')

describe('channel', () => {
  it('should be writable', (done) => {
    const plex = new Mplex(false)

    plex.on('stream', (stream) => {
      pull(pull.values([Buffer.from('hellooooooooooooo')]), stream)
    })

    utils.encodeMsg(3,
      consts.type.NEW,
      Buffer.from('chan1'),
      (err, msg) => {
        expect(err).to.not.exist()
        pull(
          pull.values([msg]),
          plex,
          pull.drain((_data) => {
            expect(err).to.not.exist()
            utils.decodeMsg(_data, (err, data) => {
              expect(err).to.not.exist()
              const { id, type } = data[0]
              expect(id).to.eql(3)
              expect(type).to.eql(consts.type.IN_MESSAGE)
              expect(data[1]).to.deep.eql(Buffer.from('hellooooooooooooo'))
              done()
            })
          })
        )
      })
  })

  it('should be readable', (done) => {
    const plex = new Mplex()

    plex.on('stream', (stream) => {
      pull(
        stream,
        // drain, because otherwise we have to send an explicit close
        pull.drain((data) => {
          expect(data).to.deep.eql(Buffer.from('hellooooooooooooo'))
          done()
        })
      )
    })

    series([
      (cb) => utils.encodeMsg(3,
        consts.type.NEW,
        Buffer.from('chan1'), cb),
      (cb) => utils.encodeMsg(3,
        consts.type.IN_MESSAGE,
        Buffer.from('hellooooooooooooo'),
        cb)
    ], (err, msgs) => {
      expect(err).to.not.exist()
      pull(
        pull.values(msgs),
        plex
      )
    })
  })

  it('initiator should be able to send data', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const stream = plex1._newStream(plex1.nextChanId(true), true, 'stream 1')
    pull(
      pull.values([Buffer.from('hello from plex1!!')]),
      stream
    )

    plex2.on('stream', (stream) => {
      pull(
        stream,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data[0]).to.deep.eql(Buffer.from('hello from plex1!!'))
          done()
        })
      )
    })
  })

  it('receiver should be able to send data', (done) => {
    const p = pair()

    const plex1 = new Mplex()
    const plex2 = new Mplex()

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const id = plex1.nextChanId(true)
    const chan1 = plex1._newStream(id, true, true, 'stream 1')

    const chan2 = plex2._newStream(id, false, true, 'stream 2')

    pull(
      pull.values([Buffer.from('hello from plex2!!')]),
      chan2
    )

    pull(
      chan1,
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.deep.eql(Buffer.from('hello from plex2!!'))
        done()
      })
    )
  })

  it('sending close msg finalizes stream', (done) => {
    const plex = new Mplex()

    plex.on('stream', (stream) => {
      pull(
        stream,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(stream._endedRemote).to.be.ok()
          expect(stream._endedLocal).to.be.ok()
          expect(data[0]).to.deep.eql(Buffer.from('hellooooooooooooo'))
          done()
        })
      )
    })

    series([
      (cb) => utils.encodeMsg(3,
        consts.type.NEW,
        Buffer.from('chan1'), cb),
      (cb) => utils.encodeMsg(3,
        consts.type.IN_MESSAGE,
        Buffer.from('hellooooooooooooo'),
        cb),
      (cb) => utils.encodeMsg(3,
        consts.type.IN_CLOSE,
        Buffer.from([]),
        cb)
    ], (err, msgs) => {
      expect(err).to.not.exist()
      pull(
        pull.values(msgs),
        plex
      )
    })
  })

  it('closing channel should allow reading but not writing', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const chan1 = plex1.newStream('stream 1')

    pull(
      pull.values([Buffer.from('hello')]),
      chan1,
      pull.through(d => console.dir(d.toString())),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.deep.eql(Buffer.from('hello'))
        done()
      })
    )

    plex2.on('stream', (stream) => {
      pull(
        stream,
        pull.through(d => console.dir(d.toString())),
        stream
      )
    })
  })
})
