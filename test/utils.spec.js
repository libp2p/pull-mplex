/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(require('chai-checkmark'))
chai.use(dirtyChai)

const pull = require('pull-stream')

const utils = require('../src/utils')

describe('utils', () => {
  it('encodes header', () => {
    pull(
      pull.values([[17, 0, Buffer.from('17')]]),
      utils.encode(),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.be.eql(Buffer.from('8801023137', 'hex'))
      })
    )
  })

  it('decodes header', () => {
    pull(
      pull.values([Buffer.from('8801023137', 'hex')]),
      utils.decode(),
      pull.collect((err, data) => {
        expect(err).to.not.exist()
        expect(data[0]).to.be.eql({ id: 17, type: 0, data: Buffer.from('17') })
      })
    )
  })
})