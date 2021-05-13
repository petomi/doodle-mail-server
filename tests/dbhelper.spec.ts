import testdb from './test-db'
import dbhelper from '../helpers/dbhelper'
import { IMessage } from '../models/message'
import { IRoom } from '../models/room'
import IUser from '../models/user'

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
})

describe('joinRoom', () => {
  it('It should add the user to the room', async (done) => {
    dbhelper.joinRoom(testUser, testRoom.entryCode).then((room) => {
      expect(room?.entryCode).toBe('ABCD')
      expect(room?.participants.length).toBe(3)
      done()
    })
  })
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
})

describe('getRoomMessages', () => {
  it('Gets all messages for the selected room.', async (done) => {
    dbhelper.getRoomMessages(testRoom._id).then((room) => {
      expect(room?.messages.length).toBe(2)
      done()
    })
  })
})

describe('sendMessageToRoom', () => {
  it('Adds a message to the indicated room.', async (done) => {
    dbhelper.sendMessageToRoom(testMessage, testUser, testRoom._id).then((room) => {
      expect(room?.messages.length).toBe(3)
      done()
    })
  })
})

describe('DELETE /messages', () => {
  it('Deletes the desired message', async (done) => {
    dbhelper.deleteMessageById(testMessage._id).then(() => {
      done()
    })
  })
})

