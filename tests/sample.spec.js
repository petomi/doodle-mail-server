const mongoose = require('mongoose')
const dbHandler = require('./db-handler')
const api = require('../server')

/**
 * Connect to a new in-memory DB before running tests
 */
beforeAll(async () => {
    await dbHandler.connect().then(
        await dbHandler.seedData()
    )
})

/**
 * Clear all test data after every test
 */
afterEach(async () => await dbHandler.clearDatabase())

/**
 * Remove and close the db and server after testing
 */
afterAll(async () => await dbHandler.closeDatabase())


describe('Sample Test', () => {
    it('should test that true == true', () => {
        expect(true).toBe(true)
    })
})