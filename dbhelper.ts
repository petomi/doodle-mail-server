import Message, { IMessage } from "./models/message"
import Room, { IRoom } from "./models/room"
import User, { IUser } from "./models/user"
import mongoose, { Query } from 'mongoose'
import { IUpdatedUser } from "./models/updated-user"
import { IMessageData } from "./models/message-data"
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
    path: 'participants',
    select: '-email -password'
  }).populate({
    path: 'messages',
    select: '-room',
    populate: {
      path: 'author',
      select: '-email-password'
    }
  })
}

/**
 * Create a new chat room.
 * @param {string} userId The id of the user creating the room.
 * @param {string} roomCode The 4 digit code used to join the room.
 * @returns {Promise<Object>} Promise object represents the created room info.
 */
const createRoom = (userId: string, roomCode: string): Promise<IRoom> => {
  return Room.create({
    entryCode: roomCode,
    participants: [userId],
    messages: []
  })
}

/**
 * Join a chat room by room code.
 * @param {string} userId The id of the user joining the room.
 * @param {string} roomCode The 4 digit room code of the room being joined.
 * @returns {Promise<Object>} Promise object represents the room after joining.
 */
const joinRoom = (userId: string, roomCode: string): Query<IRoom | null, IRoom> => {
  return Room.findOneAndUpdate({
    entryCode: roomCode
  }, {
    $push: {
      participants: new ObjectId(userId)
    }
  }, {
    new: true // get result after performing the update
  }).populate({
    path: 'participants',
    select: '-email -password'
  }).populate({
    path: 'messages',
    select: '-room',
    populate: {
      path: 'author',
      select: '-email-password'
    }
  })
}

/**
 * Leave chat room by room code.
 * @param {string} userId The id of the user that is leaving the room.
 * @param {string} roomCode The 4 digit room code of the room being left.
 * @returns {Promise}
 */
const leaveRoom = (userId: string, roomCode: string): Promise<void> => {
  return new Promise<void>(function (resolve, reject) {
    Room.findOneAndUpdate({
      entryCode: roomCode
    }, {
      // remove user from room by id
      $pull: {
        participants: new ObjectId(userId)
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
      select: '-room',
      populate: {
        path: 'author',
        select: '-email -password'
      }
    })
}

/**
 * Send a message to a chat room.
 * @param {Object} message The message object being sent to the chat room.
 * @param {string} message.title The title of the message.
 * @param {string} message.imageData The image data, saved to a base64 string.
 * @param {string} message.background The background color of the image, as hex code or name.
 * @param {string} userId The id of the user sending the message.
 * @param {string} roomId The id of the room to send the message to.
 * @returns {Promise<Object>} Promise object represents the room state after message is sent.
 */
const sendMessageToRoom = (message: IMessageData, userId: string, roomId: string): Promise<IRoom | null> => {
  return new Promise(function (resolve, reject) {
    Message.create({
      author: new ObjectId(userId),
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
          populate: {
            path: 'author',
            select: '-email -password'
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
 * Delete a message by message id.
 * @param {string} messageId The id of the message to delete.
 * @returns {Promise}
 */
const deleteMessageById = (messageId: string): Query<IMessage | null, IMessage> => {
  return Message.findByIdAndDelete(messageId)
}

/**
 * Get a user profile by profile id.
 * @param {string} userId The id of the user being fetched.
 * @returns {Promise<Object>} Promise object represents the fetched user profile.
 */
const getUserProfileById = (userId: string): Query<IUser | null, IUser> => {
  return User.findById(userId, {
    name: 1,
    email: 1
  })
}

/**
 * Get a user profile by email.
 * @param {string} email The email of the user being fetched.
 * @returns {Promise<Object>} Promise object represents the fetched user profile.
 */
const getUserProfileByEmail = (email: string): Query<IUser | null, IUser> => {
  return User.findOne({
    email: email
  })
}

/**
 * Create a user profile.
 * @param {string} name The name of the user being created.
 * @param {string} email The email of the user being created.
 * @param {string} hashedPassword The password of the user being created, hashed and salted.
 * @returns {Promise<Object>} Promise object represents the created user profile.
 */
const createUserProfile = (name: string, email: string, hashedPassword: string): Promise<IUser | null> => {
  return new Promise(function (resolve, reject) {
    User.create({
      name: name,
      email: email,
      password: hashedPassword,
      // avatar: req.body.avatar,
    }).then(() => {
      // log in user with token
      User.findOne({
        email: email
      }).then((user: IUser | null) => {
        resolve(user)
      }).catch((err: Error) => {
        console.log(`Error finding new user: ${err}`)
        reject()
      })
    }).catch((err: Error) => {
      console.log(`Error creating user profile: ${err}`)
      reject()
    })
  })
}

/**
 * Update a user profile by user id.
 * @param {string} userId The id of the user being updated.
 * @param {Object} updatedProperties An object containing the udpates to make for the user profile.
 * @param {string?} updatedProperties.name The new name of the user.
 * @param {string} updatedProperties.email The new email for the user.
 * @param {string} updatedProperties.password The new password for the user (hashed and salted).
 * @returns {Promise<Object>} Promise object represents the updated user profile.
 */
const updateUserProfile = (userId: string, updatedProperties: IUpdatedUser): Query<IUser | null, IUser> => {
  return User.findByIdAndUpdate(
    userId, {
    $set: updatedProperties
  }, {
    new: true
  }
  )
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
  getUserProfileById,
  getUserProfileByEmail,
  createUserProfile,
  updateUserProfile
}
