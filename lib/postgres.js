'use strict'

const URL = require('url')
const PhobosPostgresModel = require('./model')
const DefaultOptions = require('../config/postgres-options')

class PhobosPostgres {

  init(options = {}) {
    this.connection = null
    this._pg = options.instance ? options.instance : require('pg')

    if (options.noNative !== true) this._pg = this._pg.native

    const pgConnection = options.connection.uri ? this.parseURIString(options.connection.uri) : options.connection
    const pgConfig = Object.assign({}, DefaultOptions.config, pgConnection)

    this._connect(pgConfig).then(() => {
      PhobosPostgresModel._store = this.connection
    })
  }

  parseURIString(uri) {
    const parsed = URL.parse(uri)
    const auth = parsed.auth.split(':')

    return {
      user: auth[0],
      password: auth[1],
      host: parsed.hostname,
      port: parsed.port,
      database: parsed.pathname.split('/')[1]
    }
  }

  _connect(pgConfig) {
    return new Promise((resolve, reject) => {
      const pool = new (this._pg).Pool(pgConfig)

      pool.on('error', (error, client) => {
        console.error(error)
      })

      pool.connect((err, client) => {
        return resolve(client)
      })
    })
  }

}

module.exports = PhobosPostgres
