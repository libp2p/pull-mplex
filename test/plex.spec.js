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
  it.only(`destroy should close both ends`, (done) => {
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

    plex1.destroy()
  })

  it(`channel id should be correct`, () => [1, 0].forEach((type) => {
    const initiator = Boolean(type)
    const plex = new Plex(initiator)

    const times = 10
    for (let i = 0; i < times; i++) {
      expect(Boolean(plex._nextChanId() & 1)).to.be.eql(initiator)
    }
  }))
})
