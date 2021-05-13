import nanoid from 'nanoid'
import Message, { IMessage } from "../models/message"
import Room, { IRoom } from "../models/room"
import mongoose, { Query } from 'mongoose'
import { IMessageData } from "../models/message-data"
import IUser from '../models/user'
const ObjectId = mongoose.Types.ObjectId


/**
 * Creates a Mongo DB connection instance.
 */
const createConnection = (mongoHost: string): void => {
  mongoose.set('useFindAndModify', false)
  mongoose.connect(mongoHost, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  // if connection is successful, create DB and initialize server
  const db = mongoose.connection
  // bind connection on error event
  db.on('error', console.error.bind(console, 'MongoDB connection error:'))
}

/**
 * Closes the Mongo DB connection.
 */
const closeConnection = (): void => {
  mongoose.disconnect()
}

/**
 * Gets info for all chat rooms.
 * @returns {Promise<Array<Object>>}
 */
const getAllRoomInfo = (): Query<IRoom[], IRoom> => {
  return Room.find({})
}

/**
 * Get info for a specific chat room by alpha code.
 * @param {string} roomCode The 4 digit code used to join the room.
 * @returns {Promise<Object>} Promise object represents the room info.
 */
const getRoomInfo = (roomCode: string): Query<IRoom | null, IRoom> => {
  return Room.findOne({
    entryCode: roomCode
  }).populate({
    path: 'messages',
    select: '-room',
    options: {
      sort: { 'date': -1 }
    }
  })
}

/**
 * Create a new chat room.
 * @param {Object} user The user object of the user joining the room.
 * @param {string} user.userName The name of the user joining the room.
 * @param {string} user.Id The id of the user joining the room.
 * @param {string} roomCode The 4 digit code used to join the room.
 * @returns {Promise<Object>} Promise object represents the created room info.
 */
const createRoom = (user: IUser, roomCode: string): Promise<IRoom> => {
  return Room.create({
    entryCode: roomCode,
    participants: [user],
    messages: []
  })
}

/**
 * Join a chat room by room code.
 * @param {Object} user The user object of the user joining the room.
 * @param {string} user.userName The name of the user joining the room.
 * @param {string} user.Id The id of the user joining the room.
 * @param {string} roomCode The 4 digit room code of the room being joined.
 * @returns {Promise<Object>} Promise object represents the room after joining.
 */
const joinRoom = (user: IUser, roomCode: string): Query<IRoom | null, IRoom> => {
  return Room.findOneAndUpdate({
    entryCode: roomCode
  }, {
    $push: {
      participants: user
    }
  }, {
    new: true // get result after performing the update
  }).populate({
    path: 'messages',
    select: '-room',
    options: {
      sort: { 'date': -1 }
    }
  })
}

/**
 * Leave chat room by room code.
 * @param {Object} user The user object of the user joining the room.
 * @param {string} user.userName The name of the user joining the room.
 * @param {string} user.Id The id of the user joining the room.
 * @param {string} roomCode The 4 digit room code of the room being left.
 * @returns {Promise}
 */
const leaveRoom = (user: IUser, roomCode: string): Promise<void> => {
  return new Promise<void>(function (resolve, reject) {
    Room.findOneAndUpdate({
      entryCode: roomCode
    }, {
      // remove user from room by id
      $pull: {
        participants: user
      }
    }, {
      new: true // get result after performing the update.
    }).then(() => {
      resolve()
    }).catch((err: Error) => {
      console.log(`Error leaving room: ${err}`)
      reject()
    })
  })
}

/**
 * Get room messages by room id.
 * @param {string} roomId The id of the room to get messages for.
 * @returns {Promise<Array<Object>>} Promise object represents an array of messages from the room.
 */
const getRoomMessages = (roomId: string): Query<IRoom | null, IRoom> => {
  return Room.findById(roomId)
    .populate({
      path: 'messages',
      select: '-room',
      options: {
        sort: { date: 'desc' }
      }
    })
}

/**
 * Send a message to a chat room.
 * @param {Object} message The message object being sent to the chat room.
 * @param {string} message.title The title of the message.
 * @param {string} message.imageData The image data, saved to a base64 string.
 * @param {string} message.background The background color of the image, as hex code or name.
 * @param {Object} user The user object of the user joining the room.
 * @param {string} user.userName The name of the user joining the room.
 * @param {string} user.Id The id of the user joining the room.
 * @param {string} roomId The id of the room to send the message to.
 * @returns {Promise<Object>} Promise object represents the room state after message is sent.
 */
const sendMessageToRoom = (message: IMessageData, user: IUser, roomId: string): Promise<IRoom | null> => {
  return new Promise(function (resolve, reject) {
    Message.create({
      author: user,
      room: new ObjectId(roomId),
      title: message.title,
      date: new Date(),
      imageData: message.imageData,
      background: message.background
    })
      .then((message: IMessage) => {
        Room.findByIdAndUpdate(roomId, {
          $push: {
            messages: new ObjectId(message._id)
          }
        }, {
          new: true
        }).populate({
          path: 'messages',
          select: '-room',
          options: {
            sort: { date: 'desc' }
          }
        }).then((room: IRoom | null) => {
          resolve(room)
        })
      }).catch((err: Error) => {
        console.log(`Error sending message to room: ${err}`)
        reject()
      })
  })
}

/**
 * Returns info for a single message by id.
 * @param messageId The id of the message to find
 * @returns {Promise<Object>}
 */
const getMessageById = (messageId: string): Query<IMessage | null, IMessage> => {
  return Message.findById(messageId)
}

/**
 * Delete a message by message id.
 * @param {string} messageId The id of the message to delete.
 * @returns {Promise}
 */
const deleteMessageById = (messageId: string): Query<IMessage | null, IMessage> => {
  return Message.findByIdAndDelete(messageId)
}

/**
 * Generate 4 character room code and check for uniqueness.
 * @returns {Promise<string>}
 */
const generateUniqueRoomCode = async (): Promise<string> => {
  let isUniqueCode = false
  let roomCode = nanoid.nanoid(4)
  while (!isUniqueCode) {
    // check to see if roomCode already exists
    console.log(`Checking roomCode ${roomCode} for uniqueness.`)
    const room: IRoom | null = await getRoomInfo(roomCode)
    if (room != null) {
      // generate another roomCode since the last one wasn't unique
      roomCode = nanoid.nanoid(4)
    } else {
      isUniqueCode = true
    }
  }
  return roomCode
}

export default {
  createConnection,
  closeConnection,
  getAllRoomInfo,
  getRoomInfo,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomMessages,
  sendMessageToRoom,
  getMessageById,
  deleteMessageById,
  generateUniqueRoomCode
}
