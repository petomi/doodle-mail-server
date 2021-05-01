import nanoid from 'nanoid'
import logWithDate from './loghelper'
import Message, { IMessage } from "../models/message"
import Room, { IRoom } from "../models/room"
import mongoose, { Query } from 'mongoose'
import { IMessageData } from "../models/message-data"
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
    select: '-room'
  })
}

/**
 * Create a new chat room.
 * @param {string} userName The id of the user creating the room.
 * @param {string} roomCode The 4 digit code used to join the room.
 * @returns {Promise<Object>} Promise object represents the created room info.
 */
const createRoom = (userName: string, roomCode: string): Promise<IRoom> => {
  return Room.create({
    entryCode: roomCode,
    participants: [userName],
    messages: []
  })
}

/**
 * Join a chat room by room code.
 * @param {string} userName The id of the user joining the room.
 * @param {string} roomCode The 4 digit room code of the room being joined.
 * @returns {Promise<Object>} Promise object represents the room after joining.
 */
const joinRoom = (userName: string, roomCode: string): Query<IRoom | null, IRoom> => {
  return Room.findOneAndUpdate({
    entryCode: roomCode
  }, {
    $push: {
      participants: userName
    }
  }, {
    new: true // get result after performing the update
  }).populate({
    path: 'messages',
    select: '-room'
  })
}

/**
 * Leave chat room by room code.
 * @param {string} userName The id of the user that is leaving the room.
 * @param {string} roomCode The 4 digit room code of the room being left.
 * @returns {Promise}
 */
const leaveRoom = (userName: string, roomCode: string): Promise<void> => {
  return new Promise<void>(function (resolve, reject) {
    Room.findOneAndUpdate({
      entryCode: roomCode
    }, {
      // remove user from room by id
      $pull: {
        participants: userName
      }
    }, {
      new: true // get result after performing the update.
    }).then((room: IRoom | null) => {
      // if room is empty, delete room
      if (room != null && room.participants.length === 0) {
        Room.deleteOne({
          _id: room._id
        }).then(() => {
          resolve()
        })
      } else {
        resolve()
      }
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
      select: '-room'
    })
}

/**
 * Send a message to a chat room.
 * @param {Object} message The message object being sent to the chat room.
 * @param {string} message.title The title of the message.
 * @param {string} message.imageData The image data, saved to a base64 string.
 * @param {string} message.background The background color of the image, as hex code or name.
 * @param {string} userName The id of the user sending the message.
 * @param {string} roomId The id of the room to send the message to.
 * @returns {Promise<Object>} Promise object represents the room state after message is sent.
 */
const sendMessageToRoom = (message: IMessageData, userName: string, roomId: string): Promise<IRoom | null> => {
  return new Promise(function (resolve, reject) {
    Message.create({
      author: userName,
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
          select: '-room'
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
 * Delete a message by message id.
 * @param {string} messageId The id of the message to delete.
 * @returns {Promise}
 */
const deleteMessageById = (messageId: string): Query<IMessage | null, IMessage> => {
  return Message.findByIdAndDelete(messageId)
}

/**
 * Generate a 4 character room code (and check for collisions)
 * @returns {Promise<string>}
 */
const generateRoomCode = () : Promise<string>  => {
  return new Promise<string>(function(resolve, reject) {
    // create a room with unique 4 char guid
    let roomCode = nanoid.nanoid(4)
    let roomCodeValid = false
    let numberOfRegens = 0
    // check for roomCode collisions (unlikely, but let's be safe)
    while (!roomCodeValid) {
      getRoomInfo(roomCode).then((existingRoom) => {
        if (existingRoom == null) {
          // keep this roomCode, as it is unique
          roomCodeValid = true
          resolve(roomCode)
        } else if (numberOfRegens > 5) {
          // break out if too many collisions are happening
          reject()
        }
        else {
          console.log(existingRoom)
          // generate a new roomCode
          logWithDate(`Room code ${roomCode} was taken. Generating another.`)
          roomCode = nanoid.nanoid(4)
          numberOfRegens++
        }
      })
    }
    reject()
  })

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
  deleteMessageById,
  generateRoomCode
}
