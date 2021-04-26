const { MongoClient } = require('mongodb')
const { connection } = require('mongoose')
const { User } = require('../models/schema.js')


// May require additional time for downloading MongoDB binaries
// eslint-disable-next-line no-undef
jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000;

let mongoServer

/**
 * Connect to a new in-memory DB before running tests
 */
beforeAll(async () => {
  // TODO - figure out why this hangs
  connection = await MongoClient.connect(process.env.MONGO_URL, {
    userNewUrlParser: true,
    useUnifiedTopology: true
  })
  db = await connection.db()
  console.log('server created!')
})

/**
 * Remove and close the db and server after testing
 */
afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

describe('Sample Test', () => {
  it('should test that number of users = 2', async () => {
    const count = await User.count()
    expect(count).toEqual(0)
  })
})
