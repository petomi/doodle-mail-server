const request = require('supertest')
const testdb = require('./test-db')
const app = require('../server')
const {
  User,
  Room
} = require('../models/schema')

const agent = request.agent(app)

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
 * Clear db and re-seed data between each test
 */
beforeEach(async () => {
  await testdb.clear()
  await testdb.seed()
})

// TODO - write unit tests to handle errors gracefully!

describe('GET /', () => {
  it('It should return a welcome message.', done => {
    agent
      .get('/')
      .expect(200)
      .then(res => {
        expect(res.text).toBe('Welcome to doodle-mail!')
        done()
      })
  })
})

describe('GET /rooms/info', () => {
  it('It should return all the available room data.', done => {
    agent
      .get('/rooms/info')
      .expect(200)
      .then(res => {
        expect(res.body.rooms.length).toBe(1)
        expect(res.body.rooms[0].entryCode).toBe('ABCD')
        done()
      })
  })
})

describe('GET /rooms/:roomCode/info', () => {
  it('It should return data for a specific room.', done => {
    agent
      .get('/rooms/ABCD/info')
      .expect(200)
      .then(res => {
        expect(res.body.room.entryCode).toBe('ABCD')
        expect(res.body.room.participants.length).toBe(2)
        expect(res.body.room.messages.length).toBe(2)
        done()
      })
  })
})

describe('POST /rooms', () => {
  it('It should create a new room.', async (done) => {
    const users = await User.find({})
    agent
      .post('/rooms')
      .send({
        userId: users[0]._id
      })
      .expect(200)
      .then(res => {
        expect(res.body.room.entryCode.length).toBe(4)
        expect(res.body.room.participants.length).toBe(1)
        done()
      })
  })
})

describe('POST /rooms/:roomCode/join', () => {
  it('It should add the user to the room', async (done) => {
    const users = await User.find({})
    agent
      .post('/rooms/ABCD/join')
      .send({
        userId: users[2]._id
      })
      .expect(200)
      .then(res => {
        expect(res.body.room.entryCode).toBe('ABCD')
        expect(res.body.room.participants.length).toBe(3)
        done()
      })
  })
})

describe('POST /rooms/:roomCode/leave', () => {
  it('It should remove the user from the room.', async (done) => {
    const users = await User.find({})
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userId: users[0]._id
      })
      .expect(200)
      .then(() => {
        done()
      })
  })
  it('Removes the room if all users have left.', async (done) => {
    const users = await User.find({})
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userId: users[0]._id
      })
      .expect(200)
      .then(() => {
        agent
          .post('/rooms/ABCD/leave')
          .send({
            userId: users[1]._id
          })
          .expect(200)
          .then(async () => {
            // check to see if room is gone now that users have left
            await Room.findOne({
                entryCode: 'ABCD'
              })
              .then((room) => {
                expect(room).toBe(null)
                done()
              })
          })
      })
  })
})

describe('GET /rooms/:roomId/messages', () => {
  it('Gets all messages for the selected room.', async (done) => {
    const room = await Room.findOne({})
    agent
      .get(`/rooms/${room._id}/messages`)
      .send({
        userId: room.participants[0]._id
      })
      .expect(200)
      .then(res => {
        expect(res.body.length).toBe(2)
        done()
      })
  })
})

describe('POST /rooms/:roomId/messages', () => {
  it('Adds a message to the indicated room.', async (done) => {
    const user = await User.findOne({})
    const room = await Room.findOne({})
    agent
      .post(`/rooms/${room._id}/messages`)
      .send({
        messages: [{
          title: 'Test Message 5',
          imageData: 'TALKJLASJD',
          background: 'blue'
        }],
        userId: user._id
      })
      .expect(200)
      .then(res => {
        expect(res.body.length).toBe(3)
        done()
      })
  })
  it('Adds multiple messages to the indicated room.', async (done) => {
    const user = await User.findOne({})
    const room = await Room.findOne({})
    agent
      .post(`/rooms/${room._id}/messages`)
      .send({
        messages: [{
            title: 'Test Message 5',
            imageData: 'TALKJLASJD',
            background: 'blue'
          },
          {
            "title": 'Test Message 6',
            "imageData": 'TALKJLASJD',
            "background": 'white'
          }
        ],
        userId: user._id
      })
      .expect(200)
      .then(res => {
        expect(res.body.length).toBe(4)
        done()
      })
  })
})

describe('DELETE /messages', () => {

})

describe('GET /users/:userId', () => {

})

describe('POST /users', () => {

})

describe('POST /users/login', () => {

})

describe('PUT /users', () => {

})
