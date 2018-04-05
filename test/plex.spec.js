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

describe('plex', () => {
  it(`reset should close both ends`, (done) => {
    const p = pair()

    const plex1 = new Plex(true)
    const plex2 = new Plex(false)

    pull(plex1, p[0], plex1)
    pull(plex2, p[1], plex2)

    expect(4).check(done)

    const errHandler = (err) => {
      expect(err.message).to.be.eql('Underlying stream has been closed').mark()
    }
    plex1.on('error', errHandler)
    plex2.on('error', errHandler)

    plex2.on('close', () => {
      expect().mark()
    })

    plex2.on('close', () => {
      expect().mark()
    })
    plex1.reset()
  })

  describe(`check id`, () => [true, false].forEach((initiator) => {
    it(`id should be ${initiator ? 'odd' : 'even'}`, () => {
      const plex = new Plex(initiator)

      const times = 100
      for (let i = 0; i < times; i++) {
        const id = plex._nextChanId()
        console.dir(id)
        expect(Boolean(id & 1)).to.be.eql(initiator)
      }
    })
  }))
})
