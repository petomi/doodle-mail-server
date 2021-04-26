const testdb = require('./test-db')
const { User } = require('../models/schema')

/**
 * Connect to a new in-memory DB before running tests
 */
beforeAll(async () => {
  await testdb.connect()
})

/**
 * Remove and close the db and server after testing
 */
afterAll(async () => {
  // delay shutdown to ensure we aren't shutting down while "writing", causing errors
  setTimeout(async() => {
    await testdb.close()
  }, 500)

})

/**
 * Clear db and re-seed data between each test
 */
beforeEach(async() => {
  await testdb.clear()
  await testdb.seed()
})

// TODO - write unit tests!

describe('Sample Test', () => {
  it('should test that number of users = 2', async () => {
    const count = await User.count()
    expect(count).toEqual(2)
  })
})
