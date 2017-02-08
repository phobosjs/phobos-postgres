'use strict'

const Inflected = require('inflected')
const QueryStream = require('pg-query-stream')
const DuplexStream = require('stream').Duplex
const Query = require('mongo-sql')
const ModelProxy = require('phobosjs-model')

/** Class representing a single model instance. This class is meant to be
 * extended by actual model classes by the user's application */
class PhobosPostgresModel {

  /**
   * Create an instance of the model.
   * @param {object} data - Attributes for the new model.
   */
  constructor(data = {}) {
    this.table = Inflected.pluralize(this.constructor.name.toLowerCase())

    this._dirty = {}
    this._canonical = {}

    // If we have an id in the payload, then this is a result and not a new model
    this[data.id ? '_canonical' : '_dirty'] = data

    return new ModelProxy(this)
  }

  /**
   * Saves an instance of the model to the store.
   * @return {Promise} Returns a Promise for the query to save.
   */
  save() {
    // Don't run a save if there is no changes!
    if (Object.keys(this._dirty) < 1) return PhobosPostgresModel.runQuery()

    const queryType = this._canonical.id ? 'update' : 'insert'

    const query = {
      type: queryType,
      table: this.table,
      values: this._dirty,
      returning: Object.keys(this.constructor.fields)
    }

    query.where = { id: this._canonical.id }

    const queryObject = PhobosPostgresModel.queryObject(query)

    return this.constructor.runQuery(queryObject.query, queryObject.values)
  }

  /**
   * Deletes the row from the store.
   * @return {Promise} Returns a Promise for the query to delete.
   */
  delete() {
    // We cannot delete something that hasn't yet been saved!
    if (!this._canonical.id) return PhobosPostgresModel.runQuery()

    const queryObject = PhobosPostgresModel.queryObject({
      type: 'delete',
      table: this.table,
      where: { id: this._canonical.id }
    })

    return this.constructor.runQuery(queryObject.query, queryObject.values)
  }

  /**
   * Bootstraps and migrates the table as needed - done internally in phobos.js
   */
  set(prop, value) {
    return this._dirty[prop] = value
  }

  get(prop) {
    return this._dirty[prop] || this._canonical[prop]
  }

  toObject() {
    return Object.assign({}, this._canonical, this._dirty)
  }

  /**
   * Runs an SQL query on the store.
   * @param {string} query - A raw SQL query, but with $1 tokens instead of parameters.
   * @param {array} params - An array of values to use for the query.
   * @return {Promise} Returns a Promise for the query to save.
   */
  static runQuery(query, params, { stream = false, lean = false, first = false, last = true } = {}) {
    PhobosPostgresModel.queryLog(query, params)

    return new Promise((resolve, reject) => {
      if (!query || !params) return resolve([])

      if (stream) {
        this.store.connect((err, client, release) => {
          const streamableQuery = new QueryStream(query, params)
          const queryStream = client.query(streamableQuery)

          queryStream.on('end', () => release())

          return resolve(queryStream)
        })
      }

      this.store.query(query, params, (err, result) => {
        if (err) return reject(err)

        if (first && result.rowCount > 0) {
          const firstRow = result.rows[0]
          return resolve(lean ? firstRow : new (this)(firstRow))
        }

        if (last && result.rowCount > 0) {
          const lastRow = result.rows[result.rowCount - 1]
          return resolve(lean ? lastRow : new (this)(lastRow))
        }

        if (lean) return resolve(result.rows)

        const instances = []

        for (const row of result.rows) instances.push(new (this)(row))

        return resolve(instances)
      })
    })
  }

  /**
   * Returns all of a given resource.
   * @param {number} limit - Limit the query to a certain amount of records.
   * @param {string} order - ASC (ascending) or DESC (descending).
   * @param {string} sort - The field you want to use to sort the values.
   * @return {Promise} Returns a Promise for the query to save.
   */
  static all({ limit = 20, order = 'ASC', sort = 'id' } = {}) {
    const queryObject = this.queryObject({
      type: 'select',
      table: this.table,
      limit,
      order: `${sort} ${order}`
    })

    return this.runQuery(queryObject.query, queryObject.values)
  }

  /**
   * Runs a constrained query on the datastore.
   * @param {number} limit - Limit the query to a certain amount of records.
   * @param {string} order - ASC (ascending) or DESC (descending).
   * @param {string} sort - The field you want to use to sort the values.
   * @param {object} where - This holds all the clauses corresponding to the WHERE
   * @return {Promise} Returns a Promise for the query to save.
   */
  static find({ limit = 20, order = 'ASC', sort = 'id', where = {} } = {}) {
    const queryObject = this.queryObject({
      type: 'select',
      table: this.table,
      limit,
      order: `${sort} ${order}`,
      where
    })

    return this.runQuery(queryObject.query, queryObject.values)
  }

  /**
   * Returns a single record, fetched by ID.
   * @param {number} id - The id of the record you want to return.
   * @return {Promise} Returns a Promise for the query to save.
   */
  static one(id) {
    if (!id) throw new Error('Model#one() requires an ID parameter')

    const queryObject = this.queryObject({
      type: 'select',
      table: this.table,
      limit: 1,
      where: { id }
    })

    return this.runQuery(queryObject.query, queryObject.values, { first: true })
  }

  /**
   * Like find(), runs a constrained query. This one is cheaper to run for counting than a find() and counting the records.
   * @param {number} limit - Limit the query to a certain amount of records.
   * @param {string} order - ASC (ascending) or DESC (descending).
   * @param {string} sort - The field you want to use to sort the values.
   * @param {object} where - This holds all the clauses corresponding to the WHERE
   * @return {Promise} Returns a Promise for the query to save.
   */
  static count(where) {
    const queryObject = this.queryObject({
      type: 'select',
      table: this.table,
      where,
      columns: [ 'count(*)' ]
    })

    return this.runQuery(queryObject.query, queryObject.values)
  }

  /**
   * Logs the currently executing query for the benefit of debugging.
   * @param {string} query - A raw SQL query, but with $1 tokens instead of parameters.
   * @param {array} params - An array of values to use for the query.
   */
  static queryLog(query, params) {
    console.info('[QUERY]', query, params)
  }

  /**
   * Returns the table name of this model
   */
  static get table() {
    return Inflected.pluralize(this.name.toLowerCase())
  }

  /**
   * A wrapper around the `mongo-sql` library that Phobos.js uses to build SQL
   */
  static get queryObject() { return Query.sql }

  /**
   * Sets a attribute (column) on the resource (table)
   * @param {string} name - The name for the field
   * @param {object} properties - An object containing some settings for the field such as type, default, etc
   */
  static attribute(name, properties) {
    if (!name) throw new Error('Model.attribute() must provide an attribute name')

    this.attributes = this.attributes || {}
    this.attributes[name] = properties
  }

  /**
   * Bootstraps and migrates the table as needed - done internally in phobos.js
   * @return {Promise} Returns a Promise for the query to create the table.
   */
  static init(db) {
    this.fields = {
      id: { type: 'serial', primaryKey: true }
    }

    for (const attr in this.attributes) {
      this.fields[attr] = this.attributes[attr]
    }

    this.fields.created_at = { type: 'timestamptz', default: 'now()' }
    this.fields.updated_at = { type: 'timestamptz', default: 'now()' }

    const queryObject = this.queryObject({
      type: 'create-table',
      table: this.table,
      ifNotExists: true,
      definition: this.fields
    })

    this.store = db

    return this.runQuery(queryObject.query, queryObject.values)
  }

}

module.exports = PhobosPostgresModel
