/* eslint-disable @typescript-eslint/no-explicit-any */
import testdb from './test-db'
import { createServer } from 'http'
import Client from 'socket.io-client'
import { Server } from 'socket.io'
import Room from '../models/room'

let room
let message
let io, serverSocket, clientSocket

/**
 * Connect to a new in-memory DB before running tests
 */
beforeAll(async (done) => {
  await testdb.connect()
  const httpServer = createServer()
  io = new Server(httpServer)
  // middleware to check for userName
  io.use((socket, next) => {
    const userName = socket.handshake.auth.userName
    if (!userName) {
      return next(new Error('Invalid username'))
    }
    socket.userName = userName
    next()
  })
  httpServer.listen(() => {
    const port = httpServer.address()?.port
    clientSocket = new Client(`http://localhost:${port}`)
    io.on('connection', (socket) => {
      serverSocket = socket
    })
    clientSocket.on('connect', done)
  })
})

/**
 * Remove and close the db and server after testing
 */
afterAll(async () => {
  await testdb.close()
  io.close()
  clientSocket.close()
})

/**
 * Clear db and re-seed data between each test
 */
beforeEach(async () => {
  await testdb.clear()
  await testdb.seed()
  room = await testdb.getRoom()
  message = await testdb.getMessage()
})

/**
 * Tests
 */
 describe('GET /', () => {
  it('It should return a welcome message.', (done) => {
    clientSocket.on('connection', (res) => {
      expect(res.text).toBe('Welcome to doodle-mail!')
      done()
    })
  })
})

describe('GET /rooms/info', () => {
  it('It should return all the available room data.', (done) => {
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
  it('It should return data for a specific room.', (done) => {
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
  it('It should create a new room.', (done) => {
    agent
      .post('/rooms')
      .send({
        userName: 'pleb'
      })
      .expect(200)
      .then((res: { body: { room: { entryCode: string | any[]; participants: string | any[] } } }) => {
        expect(res.body.room.entryCode.length).toBe(4)
        expect(res.body.room.participants.length).toBe(1)
        done()
      })
  })
  it(`Returns an error if the userName is not specified.`, (done) => {
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
  it('It should add the user to the room', (done) => {
    agent
      .post('/rooms/ABCD/join')
      .send({
        userName: 'jarl'
      })
      .expect(200)
      .then((res: { body: { room: { entryCode: any; participants: string | any[] } } }) => {
        expect(res.body.room.entryCode).toBe('ABCD')
        expect(res.body.room.participants.length).toBe(3)
        done()
      })
  })
  it(`Returns an error if the user is already in the room.`, (done) => {
    agent
      .post('/rooms/ABCD/join')
      .send({
        userName: 'pleb'
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
  it(`Returns an error if the userName is not specified.`, (done) => {
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
  it('It should remove the user from the room.', (done) => {
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userName: 'pleb'
      })
      .expect(200)
      .then(() => {
        done()
      })
  })
  it('Removes the room if all users have left.', (done) => {
    agent
      .post('/rooms/ABCD/leave')
      .send({
        userName: 'pleb'
      })
      .expect(200)
      .then(() => {
        agent
          .post('/rooms/ABCD/leave')
          .send({
            userName: 'bob'
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
  it(`Returns an error if the userName is not specified.`, (done) => {
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
  it('Gets all messages for the selected room.', (done) => {
    agent
      .get(`/rooms/${room._id}/messages`)
      .expect(200)
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(2)
        done()
      })
  })
  it('Returns an error if invalid roomId is given.', (done) => {
    agent
      .get(`/rooms/123/messages`)
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('POST /rooms/:roomId/messages', () => {
  it('Adds a message to the indicated room.', (done) => {
    agent
      .post(`/rooms/${room._id}/messages`)
      .send({
        messages: [{
          title: 'Test Message 5',
          imageData: 'TALKJLASJD',
          background: 'blue'
        }],
        userName: 'pleb'
      })
      .expect(200)
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(3)
        done()
      })
  })
  it('Adds multiple messages to the indicated room.', (done) => {
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
        userName: 'pleb'
      })
      .expect(200)
      .then((res: { body: string | any[] }) => {
        expect(res.body.length).toBe(4)
        done()
      })
  })
  it(`Returns an error if the userName is not specified.`, (done) => {
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
  it('Returns an error if messages are not specified.', (done) => {
    agent
      .post(`/rooms/${room._id}/messages`)
      .send({
        userName: 'pleb'
      })
      .expect(400)
      .then(() => {
        done()
      })
  })
})

describe('DELETE /messages', () => {
  it('Deletes the desired message', (done) => {
    agent
      .delete(`/rooms/${room._id}/messages`)
      .send({
        messageId: message._id
      })
      .expect(200)
      .then((res) => {
        expect(res.body.length).toBe(1)
        done()
      })
  })
  it(`Returns an error if the messageId is not specified.`, (done) => {
    agent
      .delete(`/rooms/${room._id}/messages`)
      .send({})
      .expect(400)
      .then(() => {
        done()
      })
  })
})
