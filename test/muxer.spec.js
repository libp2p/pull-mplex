/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(require('chai-checkmark'))
chai.use(dirtyChai)

const pair = require('pull-pair/duplex')
const mplex = require('../src')

describe('Mplex', () => {
  it('multiple calls to end should call back', (done) => {
    const p = pair()
    const dialer = mplex.dialer(p[0])

    expect(2).checks(done)

    dialer.end((err) => {
      expect(err).to.not.exist().mark()
    })

    dialer.end((err) => {
      expect(err).to.not.exist().mark()
    })
  })
})
