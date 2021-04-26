const testdb = require('./test-db')
const { User } = require('../models/schema.js')


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
  await testdb.close()
})

/**
 * Clear db between each test
 */
// beforeEach(async() => {
//   await testdb.clear()
// })

describe('Sample Test', () => {
  it('should test that number of users = 2', async () => {
    const count = await User.count()
    expect(count).toEqual(0)
  })
})
