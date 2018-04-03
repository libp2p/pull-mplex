/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(require('chai-checkmark'))
chai.use(dirtyChai)

const pull = require('pull-stream')
const pair = require('pull-pair/duplex')
const pushable = require('pull-pushable')
const abortable = require('pull-abortable')

const Plex = require('../src')
const utils = require('../src/utils')
const consts = require('../src/consts')

const series = require('async/series')

function closeAndWait (stream) {
  pull(
    pull.empty(),
    stream,
    pull.onEnd((err) => {
      expect(err).to.not.exist.mark()
    })
  )
}

describe('channel', () => {
  it('initiator should be able to send data', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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

    const stream = plex1.createStream('stream 1')
    pull(
      pull.values([Buffer.from('hello from plex1!!')]),
      stream
    )
  })

  it('receiver should be able to send data', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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

  it('stream can be piped to itself (echo)', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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

  it('closing sender closes stream for writting, but allows reading', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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
    sender.openChan()
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

  it('closing receiver closes stream for writting, but allows reading', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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
    sender.openChan()
    pull(
      sndrSrc,
      sender
    )

    sndrSrc.push('Here ya go!') // should be able to write to closed chan
    sndrSrc.end()
  })

  it('closed sender should allow receiver to flush data', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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
    sender.openChan()
    sndrSrc.push('hello from sender!')
    sndrSrc.end()

    pull(
      sndrSrc,
      sender
    )
  })

  it('should reset channels', (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

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
    sender.openChan()
    pull(
      sndrSrc,
      aborter,
      sender
    )
  })

  it('open a stream on both sides', (done) => {
    const p = pair()

    const dialer = new Plex(true)
    const listener = new Plex(false)

    pull(dialer, p[0], dialer)
    pull(listener, p[1], listener)

    expect(6).check(done)

    dialer.on('stream', (stream) => {
      expect(stream).to.exist.mark()
      closeAndWait(stream)
    })

    const listenerConn = listener.createStream('listener')
    listenerConn.openChan()

    listener.on('stream', (stream) => {
      expect(stream).to.exist.mark()
      closeAndWait(stream)
    })

    const dialerConn = dialer.createStream('dialer')
    dialerConn.openChan()

    closeAndWait(dialerConn)
    closeAndWait(listenerConn)
  })
})