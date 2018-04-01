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

const Mplex = require('../src')
const utils = require('../src/utils')
const consts = require('../src/consts')

const series = require('async/series')

describe('channel', () => {
  it('initiator should be able to send data between two multiplexers', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

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

    const stream = plex1._newStream(plex1.nextChanId(true), true, 'stream 1')
    pull(
      pull.values([Buffer.from('hello from plex1!!')]),
      stream
    )
  })

  it('receiver should be able to send data between two multiplexers', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const chan = plex2.createStream('stream 2')
    pull(
      pull.values([Buffer.from('hello from plex2!!')]),
      chan
    )

    plex1.on('stream', (stream) => {
      pull(
        stream,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data[0]).to.deep.eql(Buffer.from('hello from plex2!!'))
          done()
        })
      )
    })
  })

  it('stream can be piped with itself (echo)', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const chan1 = plex1.createStream('stream 1')

    plex2.on('stream', (stream) => {
      pull(
        stream,
        stream
      )
    })

    pull(
      pull.values([Buffer.from('hello')]),
      chan1,
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.deep.eql(Buffer.from('hello'))
        done()
      })
    )
  })

  it('sending close msg closes stream', (done) => {
    const plex = new Mplex(true)

    plex.on('stream', (stream) => {
      pull(
        stream,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
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

  it('closing sender closes stream for writting, but allows reading from it', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const sndrSrc = pushable()
    const rcvrSrc = pushable()

    plex2.on('stream', (receiver) => {

      pull(
        rcvrSrc,
        receiver
      )

      rcvrSrc.push('Here ya go!') // should be able to write to closed chan
      rcvrSrc.end()
    })

    const sender = plex1.createStream()
    sender.openChan(() => {
      sndrSrc.end()

      pull(
        sndrSrc,
        sender,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data[0].toString()).to.be.eql('Here ya go!')
          done()
        })
      )
    })
  })

  it('closing receiver closes stream for writting, but allows reading from it', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const sndrSrc = pushable()
    const rcvrSrc = pushable()

    plex2.on('stream', (receiver) => {
      rcvrSrc.end()

      pull(
        rcvrSrc,
        receiver,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data[0].toString()).to.be.eql('Here ya go!')
          done()
        })
      )
    })

    const sender = plex1.createStream()
    sender.openChan(() => {
      pull(
        sndrSrc,
        sender
      )

      sndrSrc.push('Here ya go!') // should be able to write to closed chan
      sndrSrc.end()
    })
  })

  it('closed sender should allow receiver to flush data', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    const sndrSrc = pushable()
    const rcvrSrc = pushable()

    plex2.on('stream', (receiver) => {

      pull(
        rcvrSrc,
        receiver,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          expect(data[0].toString()).to.be.eql('hello from sender!')
          done()
        })
      )
    })

    const sender = plex1.createStream()
    sender.openChan((err) => {
      expect(err).to.not.exist()
      sndrSrc.push('hello from sender!')
      sndrSrc.end()

      pull(
        sndrSrc,
        sender
      )
    })
  })

  it('should reset channels', (done) => {
    const p = pair()

    const plex1 = new Mplex(true)
    const plex2 = new Mplex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    plex2.on('stream', (stream) => {
      pull(
        stream,
        pull.onEnd((err) => {
          expect(err).to.exist()
          done()
        })
      )

      sndrSrc.push('hello there!') // should be able to write to closed chan
      aborter.abort(new Error('nasty error!'))
    })

    const sndrSrc = pushable()
    const sender = plex1.createStream()
    const aborter = abortable()
    sender.openChan((err) => {
      expect(err).to.not.exist()
      pull(
        sndrSrc,
        aborter,
        sender
      )
    })
  })
})
