'use strict'

const Inflected = require('inflected')

/** Class representing a single model instance. This class is meant to be
 * extended by actual model classes by the user's application */
class PhobosPostgresModel {

  /**
   * Create an instance of the model.
   * @param {object} data - Attributes for the new model.
   */
  constructor(data = {}) {
    this.table = Inflected.pluralize(this.constructor.name.toLowerCase())
  }

  /**
   * Saves an instance of the model to the store.
   * @return {Promise} Returns a Promise for the query to save.
   */
  save() {
    return PhobosPostgresModel.query()
  }

  /**
   * Deletes the row from the store.
   * @return {Promise} Returns a Promise for the query to delete.
   */
  delete() {
    return PhobosPostgresModel.query()
  }

  /**
   * Runs an SQL query on the store.
   * @param {string} query - A raw SQL query, but with $1 tokens instead of parameters.
   * @param {array} params - An array of values to use for the query.
   * @return {Promise} Returns a Promise for the query to save.
   */
  static query(query, params) {
    PhobosPostgresModel.queryLog(query, params)

    return new Promise((resolve, reject) => {

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
    return this.query(`SELECT * FROM ${this.table} LIMIT ${limit} ORDER BY ${sort} ${order}`)
  }

  /**
   * Runs a constrained query on the datastore.
   * @param {number} limit - Limit the query to a certain amount of records.
   * @param {string} order - ASC (ascending) or DESC (descending).
   * @param {string} sort - The field you want to use to sort the values.
   * @param {object} where - This holds all the clauses corresponding to the WHERE
   * @return {Promise} Returns a Promise for the query to save.
   */
  static find({ limit = 20, order = 'ASC', sort = 'id', where = null } = {}) {
    const { whereSql, whereParams } = this.buildWhereClause(where)

    return this.query(
      `SELECT * FROM ${this.table}${whereSql} LIMIT ${limit} ORDER BY ${sort} ${order}`,
      whereParams
    )
  }

  /**
   * Returns a single record, fetched by ID.
   * @param {number} id - The id of the record you want to return.
   * @return {Promise} Returns a Promise for the query to save.
   */
  static one(id) {
    if (!id) throw new Error('Model#one() requires an ID parameter')

    return this.query(
      `SELECT * FROM ${this.table} WHERE id = $1 LIMIT 1`,
      [ Number(id) ]
    )
  }

  /**
   * Like find(), runs a constrained query. This one is cheaper to run for counting than a find() and counting the records.
   * @param {number} limit - Limit the query to a certain amount of records.
   * @param {string} order - ASC (ascending) or DESC (descending).
   * @param {string} sort - The field you want to use to sort the values.
   * @param {object} where - This holds all the clauses corresponding to the WHERE
   * @return {Promise} Returns a Promise for the query to save.
   */
  static count(query) {
    return this.query()
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
   * Builds a proper WHERE clause from a javascript object for use in queries
   * @param {object} where - An object with key:value of the lookups
   * @return {object} Returns both the tokenized query, but also the parameters in an array.
   */
  static buildWhereClause(where) {
    if (!where) return { whereSql: '', whereParams: [] }

    for (const clause in where) {

    }
  }

  /**
   * Recursively goes through a given value and builds dynamic WHERE subclauses
   * @param {object} where - An object with key:value of the lookups
   * @return {mixed} Returns a proper tokenized value.
   */
  static parseWhere(object) {
    if ([ 'string', 'number', 'boolean' ].indexOf(typeof object) > -1) return object
    if (object instanceof Date) return object
  }

  static get table() {
    return Inflected.pluralize(this.name.toLowerCase())
  }

}

module.exports = PhobosPostgresModel
