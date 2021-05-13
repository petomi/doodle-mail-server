/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcrypt'
import testdb from './test-db'
import dbhelper from '../helpers/dbhelper'
import { IMessage } from '../models/message'
import Room, { IRoom } from '../models/room'
import IUser from '../models/user'

let allUsers: Array<IUser>
let user: IUser
let testRoom: IRoom
let testMessage: IMessage
let testUser: IUser

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
  testRoom = await testdb.getRoom()
  testMessage = await testdb.getMessage()
  testUser = {
    userName: 'testman',
    id: '1'
  }
})


/**
 * Tests
 */
describe('getAllRoomInfo', () => {
  it('It should return all the available room data.', done => {
    dbhelper.getAllRoomInfo().then((rooms) => {
      expect(rooms.length).toBe(1)
      expect(rooms[0].entryCode).toBe('ABCD')
      done()
    })
  })
})

describe('getRoomInfo', () => {
  it('It should return data for a specific room.', done => {
    dbhelper.getRoomInfo(testRoom.entryCode).then((room) => {
      expect(room?.entryCode).toBe('ABCD')
      expect(room?.participants.length).toBe(2)
      expect(room?.messages.length).toBe(2)
      done()
    })
  })
})

describe('createRoom', () => {
  it('It should create a new room.', async (done) => {
    dbhelper.createRoom(testUser, 'DEFG').then((room) => {
      expect(room.entryCode).toBe('DEFG')
      expect(room.participants.length).toBe(1)
      expect(room.participants[0].userName).toBe(testUser.userName)
      done()
    })
  })
  // it(`Returns an error if the userId is not specified.`, done => {
  //   agent
  //     .post('/rooms')
  //     .send({})
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
})

describe('joinRoom', () => {
  it('It should add the user to the room', async (done) => {
    dbhelper.joinRoom(testUser, testRoom.entryCode).then((room) => {
      expect(room?.entryCode).toBe('ABCD')
      expect(room?.participants.length).toBe(3)
      done()
    })
  })
  // it(`Returns an error if the userId is not specified.`, done => {
  //   agent
  //     .post('/rooms/ABCD/join')
  //     .send({})
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
})

describe('leaveRoom', () => {
  it('It should remove the user from the room.', async (done) => {
    dbhelper.leaveRoom({userName:'pleb', id: '45'}, testRoom.entryCode).then(() => {
      dbhelper.getRoomInfo(testRoom.entryCode).then((room) => {
        expect(room?.participants.length).toBe(1)
        done()
      })
    })
  })
  // it(`Returns an error if the userId is not specified.`, done => {
  //   agent
  //     .post('/rooms/ABCD/leave')
  //     .send({})
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
})

describe('getRoomMessages', () => {
  it('Gets all messages for the selected room.', async (done) => {
    dbhelper.getRoomMessages(testRoom._id).then((room) => {
      expect(room?.messages.length).toBe(2)
      done()
    })
  })
  // it(`Returns an error if the userId is not authorized.`, async (done) => {
  //   agent
  //     .get(`/rooms/${room._id}/messages`)
  //     .send({})
  //     .expect(401)
  //     .then(() => {
  //       done()
  //     })
  // })
  // it(`Returns an error if the userId is not specified.`, async (done) => {
  //   agent
  //     .get(`/rooms/${room._id}/messages`)
  //     .send({})
  //     .expect(401)
  //     .then(() => {
  //       done()
  //     })
  // })
})

describe('sendMessageToRoom', () => {
  it('Adds a message to the indicated room.', async (done) => {
    dbhelper.sendMessageToRoom(testMessage, testUser, testRoom._id).then((room) => {
      expect(room?.messages.length).toBe(3)
      done()
    })
  })
  // it('Adds multiple messages to the indicated room.', async (done) => {
  //   agent
  //     .post(`/rooms/${room._id}/messages`)
  //     .send({
  //       messages: [{
  //         title: 'Test Message 5',
  //         imageData: 'TALKJLASJD',
  //         background: 'blue'
  //       },
  //       {
  //         "title": 'Test Message 6',
  //         "imageData": 'TALKJLASJD',
  //         "background": 'white'
  //       }
  //       ],
  //       userId: user._id
  //     })
  //     .expect(200)
  //     .then((res: { body: string | any[] }) => {
  //       expect(res.body.length).toBe(4)
  //       done()
  //     })
  // })
  // it(`Returns an error if the userId is not specified.`, async (done) => {
  //   agent
  //     .post(`/rooms/${room._id}/messages`)
  //     .send({
  //       messages: [{
  //         title: 'Test Message 5',
  //         imageData: 'TALKJLASJD',
  //         background: 'blue'
  //       },
  //       {
  //         "title": 'Test Message 6',
  //         "imageData": 'TALKJLASJD',
  //         "background": 'white'
  //       }
  //       ],
  //     })
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
  // it('Returns an error if messages are not specified.', async (done) => {
  //   agent
  //     .post(`/rooms/${room._id}/messages`)
  //     .send({
  //       userId: user._id
  //     })
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
})

describe('DELETE /messages', () => {
  it('Deletes the desired message', async (done) => {
    dbhelper.deleteMessageById(testMessage._id).then(() => {
      done()
    })
  })
  // it(`Returns an error if the userId is not specified.`, done => {
  //   agent
  //     .delete('/messages')
  //     .send({})
  //     .expect(400)
  //     .then(() => {
  //       done()
  //     })
  // })
})

