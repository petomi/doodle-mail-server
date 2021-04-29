/* eslint-disable @typescript-eslint/no-explicit-any */
import request from 'supertest'
import bcrypt from 'bcrypt'
import testdb from './test-db'
import serverApp from '../server'
import { IMessage } from '../models/message'
import Room, { IRoom } from '../models/room'
import { IUser } from '../models/user'

const agent = request.agent(serverApp)

let allUsers: Array<IUser>
let user: IUser
let room: IRoom
let message: IMessage

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
  allUsers = await testdb.getAllUsers()
  user = await testdb.getUser()
  room = await testdb.getRoom()
  message = await testdb.getMessage()
})

describe('GET /', () => {
  it('It should return a welcome message.', done => {
    agent
      .get('/')
      .expect(200)
      .then((res: { text: any }) => {
        expect(res.text).toBe('Welcome to doodle-mail!')
        done()
      })
  })
})



/**
 * Tests
 */
describe('GET /rooms/info', () => {
  it('It should return all the available room data.', done => {
    agent
      .get('/rooms/info')
      .expect(200)
      .then((res: { body: { rooms: string | any[] } }) => {
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
      .then((res: { body: { room: { entryCode: any; participants: string | any[]; messages: string | any[] } } }) => {
        expect(res.body.room.entryCode).toBe('ABCD')
        expect(res.body.room.participants.length).toBe(2)
        expect(res.body.room.messages.length).toBe(2)
        done()
      })
  })
})

describe('POST /rooms', () => {
  it('It should create a new room.', async (done) => {

    agent
      .post('/rooms')
      .send({
        userId: allUsers[0]._id
      })
      .expect(200)
      .then((res: { body: { room: { entryCode: string | any[]; participants: string | any[] } } }) => {
        expect(res.body.room.entryCode.length).toBe(4)
        expect(res.body.room.participants.length).toBe(1)
        done()
      })
  })
  it(`Returns an error if the userId is not specified.`, done => {
    agent
      .post('/rooms')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('POST /rooms/:roomCode/join', () => {
  it('It should add the user to the room', async (done) => {
    agent
      .post('/rooms/ABCD/join')
      .send({
        userId: allUsers[2]._id
      })
      .expect(200)
      .then((res: { body: { room: { entryCode: any; participants: string | any[] } } }) => {
        expect(res.body.room.entryCode).toBe('ABCD')
        expect(res.body.room.participants.length).toBe(3)
        done()
      })
  })
  it(`Returns an error if the userId is not specified.`, done => {
    agent
      .post('/rooms/ABCD/join')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('POST /rooms/:roomCode/leave', () => {
  it('It should remove the user from the room.', async (done) => {
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userId: allUsers[0]._id
      })
      .expect(200)
      .then(() => {
        done()
      })
  })
  it('Removes the room if all users have left.', async (done) => {
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userId: allUsers[0]._id
      })
      .expect(200)
      .then(() => {
        agent
          .post('/rooms/ABCD/leave')
          .send({
            userId: allUsers[1]._id
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
  it(`Returns an error if the userId is not specified.`, done => {
    agent
      .post('/rooms/ABCD/leave')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('GET /rooms/:roomId/messages', () => {
  it('Gets all messages for the selected room.', async (done) => {
    agent
      .get(`/rooms/${room._id}/messages`)
      .send({
        userId: room.participants[0]._id
      })
      .expect(200)
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(2)
        done()
      })
  })
  it(`Returns an error if the userId is not authorized.`, async (done) => {
    agent
      .get(`/rooms/${room._id}/messages`)
      .send({})
      .expect(401)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the userId is not specified.`, async (done) => {
    agent
      .get(`/rooms/${room._id}/messages`)
      .send({})
      .expect(401)
      .then(() => {
        done()
      })
  })
})

describe('POST /rooms/:roomId/messages', () => {
  it('Adds a message to the indicated room.', async (done) => {
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
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(3)
        done()
      })
  })
  it('Adds multiple messages to the indicated room.', async (done) => {
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
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(4)
        done()
      })
  })
  it(`Returns an error if the userId is not specified.`, async (done) => {
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
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
  it('Returns an error if messages are not specified.', async (done) => {
    agent
      .post(`/rooms/${room._id}/messages`)
      .send({
        userId: user._id
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('DELETE /messages', () => {
  it('Deletes the desired message', async (done) => {
    agent
      .delete('/messages')
      .send({
        messageId: message._id
      })
      .expect(200)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the userId is not specified.`, done => {
    agent
      .delete('/messages')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('GET /users/:userId', () => {
  it('Gets a user by profile id.', async (done) => {
    agent
      .get(`/users/${user._id}`)
      .expect(200)
      .then((res: { body: { user: { _id: { toString: () => any } } } }) => {
        expect(res.body.user._id.toString()).toBe(user._id.toString())
        done()
      })
  })
})

describe('POST /users', () => {
  it('Adds a new user profile.', done => {
    const newUser = {
      name: 'Test Test',
      email: 'test100@test.com',
      password: 'abcd'
    }
    agent
      .post('/users')
      .send(newUser)
      .expect(200)
      .then((res: { body: { user: { name: any; email: any; password: any } } }) => {
        expect(res.body.user.name).toBe(newUser.name)
        expect(res.body.user.email).toBe(newUser.email)
        expect(bcrypt.compareSync(res.body.user.password, newUser.password))
        done()
      })
  })
  it(`Returns an error if the user email is already in use.`, done => {
    agent
      .post('/users')
      .send({
        name: 'Test Test',
        email: 'test@test.com',
        password: 'abcd'
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the user info is not specified.`, done => {
    agent
      .post('/users')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('POST /users/login', () => {
  it('Logs in the user.', done => {
    agent
      .post('/users/login')
      .send({
        email: 'test@test.com',
        password: 'abcd'
      })
      .expect(200)
      .then((res: { body: { user: { email: any }; token: any } }) => {
        expect(res.body.user.email).toBe('test@test.com')
        expect(res.body.token).not.toBe(null)
        done()
      })
  })
  it(`Returns an error if the password is not correct.`, done => {
    agent
      .post('/users/login')
      .send({
        email: 'test@test.com',
        password: '123'
      })
      .expect(401)
      .then((res: { body: { auth: any; token: any } }) => {
        expect(res.body.auth).toBe(false)
        expect(res.body.token).toBe(null)
        done()
      })
  })
  it(`Returns an error if the email is not correct.`, done => {
    agent
      .post('/users/login')
      .send({
        email: 'abc@test.com',
        password: 'abcd'
      })
      .expect(401)
      .then((res: { body: { auth: any; token: any } }) => {
        expect(res.body.auth).toBe(false)
        expect(res.body.token).toBe(null)
        done()
      })
  })
  it(`Returns an error if the login info is not specified.`, done => {
    agent
      .post('/users/login')
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('PUT /users', () => {
  // use describe to make the tests synchronous (avoid bcrypt issue)
  it('Updates the user profile (no password)', async (done) => {
    agent
      .put('/users')
      .send({
        userId: user._id,
        updatedProperties: {
          name: 'new name',
          email: 'test88@test.com'
        }
      })
      .expect(200)
      .then((res: { body: { user: { name: any; email: any } } }) => {
        expect(res.body.user.name).toBe('new name')
        expect(res.body.user.email).toBe('test88@test.com')
        done()
      })
  })
  // use describe to make the tests synchronous
  it('Updates the user profile (with password)', async (done) => {
    agent
      .put('/users')
      .send({
        userId: user._id,
        updatedProperties: {
          password: 'cdef'
        }
      })
      .expect(200)
      .then((res: { body: { user: { password: any } } }) => {
        expect(bcrypt.compareSync(res.body.user.password, 'cdef'))
        done()
      })
  })
  it('Handles situations where no updated data is provided', async (done) => {
    agent
      .put('/users')
      .send({
        userId: user._id
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the user email is already in use.`, done => {
    agent
      .post('/users')
      .send({
        name: 'Test Test',
        email: 'test@test.com',
        password: 'abcd'
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the login info is not specified.`, done => {
    agent
      .put('/users')
      .send({
        updatedProperties: {
          password: 'cdef'
        }
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
})