'use strict'

const chai = require('chai')
const pg = require('pg').native
const _Module = require('../index')

const TEST_PG_URI = 'postgres://postgres:@localhost:5432/travis_ci_test'

const expect = chai.expect

describe('phobos.js postgres', () => {
  const store = new _Module.Store()

  class Model extends _Module.Model { }

  function attachListener(func) {
    _Module.Model.prototype.queryLog = func
  }

  it('initializes a pg.Pool object', done => {
    store.init({ connection: {} }).then(pool => {
      expect(pool).to.be.instanceof(pg.Pool)
      done()
    })
  })

  it('model extends PhobosPostgresModel', done => {
    const inst = new Model()
    expect(inst).to.be.instanceof(_Module.Model)
    expect(inst.table).to.equal('models')

    done()
  })

  it('static#all()', done => {
    _Module.Model.queryLog = (query, params) => {
      expect(query).to.equal('SELECT * FROM models LIMIT 11 ORDER BY names DESC')
      expect(params).to.be.empty

      done()
    }

    expect(Model.all({ limit: 11, order: 'DESC', sort: 'names' })).to.be.instanceof(Promise)
  })

  it('static#one()', done => {
    _Module.Model.queryLog = (query, params) => {
      expect(query).to.equal('SELECT * FROM models WHERE id = $1 LIMIT 1')
      expect(params).to.contain(111)

      done()
    }

    expect(Model.one(111)).to.be.instanceof(Promise)
  })

  it('static#find()', done => {
    _Module.Model.queryLog = (query, params) => {
      expect(query).to.equal('SELECT * FROM models WHERE id = $1 LIMIT 1')
      expect(params).to.contain([])

      done()
    }

    expect(Model.find({
      where: { username: 'phobosman' }
    })).to.be.instanceof(Promise)
  })
})
