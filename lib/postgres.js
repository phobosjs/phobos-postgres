'use strict'

const URL = require('url')
const PhobosPostgresModel = require('./model')
const DefaultOptions = require('../config/postgres-options')

/** Class initializing and containing the logic to establish a connection to the datastore */
class PhobosPostgres {

  /**
   * Run internally by phobos.js to establish a connection to the store.
   * @param {object} options - pass in some connection settings
   * @return {Promise} Returns a Promise that resolves to return a pg.Pool object.
   */
  init(options = {}) {
    this._pg = options.instance ? options.instance : require('pg')

    const pgConnection = options.connection.uri ? this.parseURIString(options.connection.uri) : options.connection
    const pgConfig = Object.assign({}, DefaultOptions.config, pgConnection)

    return this._connect(pgConfig)
  }

  /**
   * Used internally to parse a postgres://* URI string into something usable by pg
   * @param {string} uri - a valid postgres://* URI object
   * @return {object} Returns an object that can be plugged into the pg.Pool constructor
   */
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

  /**
   * Internal method to initiate a pg.Pool
   * @param {object} pgConfig - A complete connection prefs object used by pg.Pool
   * @return {object} Returns a pg.Pool object
   */
  _connect(pgConfig) {
    const pool = new (this._pg).Pool(pgConfig)

    pool.on('error', error => { throw new Error(error) })
    pool.connect()

    return pool
  }

}

module.exports = PhobosPostgres
