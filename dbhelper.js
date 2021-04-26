const mongoose = require('mongoose')
const {
  User,
  Message,
  Room
} = require('./models/schema.js')
const ObjectId = mongoose.Types.ObjectId


/**
 * Creates a Mongo DB connection instance.
 */
const createConnection = () => {
  mongoose.set('useFindAndModify', false)
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhosts:27017/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  // if connection is successful, create DB and initialize server
  var db = mongoose.connection
  console.log('Database connection ready.')
  console.log(process.env.MONGO_URL) // TODO: remove this, just for debug!
  // bind connection on error event
  db.on('error', console.error.bind(console, 'MongoDB connection error:'))
}

/**
 * Gets info for all chat rooms.
 * @returns {Promise<Array<Object>>}
 */
const getAllRoomInfo = () => {
  return Room.find({})
}

/**
 * Get info for a specific chat room by alpha code.
 * @param {string} roomCode The 4 digit code used to join the room.
 * @returns {Promise<Object>} Promise object represents the room info.
 */
const getRoomInfo = (roomCode) => {
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
const createRoom = (userId, roomCode) => {
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
 * @todo TODO: check whether user is already part of room before adding them
 */
const joinRoom = (userId, roomCode) => {
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
const leaveRoom = (userId, roomCode) => {
  return new Promise(function (resolve, reject) {
    Room.findOneAndUpdate({
      entryCode: roomCode
    }, {
      // remove user from room by id
      $pull: {
        participants: new ObjectId(userId)
      }
    }, {
      new: true // get result after performing the update.
    }).then((room) => {
      // if room is empty, delete room
      if (room.participants.length === 0) {
        Room.deleteOne({
          _id: room._id
        })
      }
      resolve()
    }).catch((err) => {
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
const getRoomMessages = (roomId) => {
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
const sendMessageToRoom = (message, userId, roomId) => {
  return new Promise(function (resolve, reject) {
    Message.create({
        author: new ObjectId(userId),
        room: new ObjectId(roomId),
        title: message.title,
        date: Date.now(),
        imageData: message.imageData,
        background: message.background
      })
      .then((message) => {
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
        }).then((room) => {
          resolve(room)
        })
      }).catch((err) => {
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
const deleteMessageById = (messageId) => {
  return Message.findByIdAndDelete(messageId)
}

/**
 * Get a user profile by profile id.
 * @param {string} userId The id of the user being fetched.
 * @returns {Promise<Object>} Promise object represents the fetched user profile.
 */
const getUserProfileById = (userId) => {
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
const getUserProfileByEmail = (email) => {
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
 * @todo TODO: check for duplicate user names and emails before allowing signup
 */
const createUserProfile = (name, email, hashedPassword) => {
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
      }).then((user) => {
        resolve(user)
      }).catch((err) => {
        console.log(`Error finding new user: ${err}`)
        reject()
      })
    }).catch((err) => {
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
const updateUserProfile = (userId, updatedProperties) => {
  return User.findByIdAndUpdate(
    userId, {
      $set: updatedProperties
    }, {
      new: true
    }
  )
}

/**
 * Seeds the database with test data.
 * @todo TODO: Move this to a separate module?
 * @returns {Promise}
 */
const seedTestData = () => {
  return new Promise(function (resolve, reject) {
    User.create([{
        name: 'Jim Test',
        email: 'test@test.com',
        password: '$2b$08$KLu9La4ucbj.aKDBnS/9d.TnsrrEp.yyQHcuJZFkNrCFt0MQEAgK2'
      },
      {
        name: 'Bob Test',
        email: 'test2@test.com',
        password: '$2b$08$ZCNcsq1agfLQvV3Von21nu9po452CsgFDD1ccQLBBTGhIAziQXVJO'
      }
    ]).then((users) => {
      Room.create({
        entryCode: 'ABCD',
        participants: [
          new ObjectId(users[0]._id),
          new ObjectId(users[1]._id)
        ],
        messages: []
      }).then((room) => {
        Message.create([{
            author: new ObjectId(users[0]._id),
            room: new ObjectId(room._id),
            title: 'Test Message 1',
            date: Date.now(),
            imageData: 'testimagedata',
            background: 'white'
          },
          {
            author: new ObjectId(users[1]._id),
            room: new ObjectId(room._id),
            title: 'Test Message 2',
            date: Date.now(),
            imageData: 'testimagedata',
            background: 'white'
          }
        ]).then((messages) => {
          messages.forEach((message) => {
            Room.findByIdAndUpdate(room._id, {
              $push: {
                messages: new ObjectId(message._id)
              }
            }).then(() => {
              resolve()
            }).catch(() => {
              reject()
            })
          })
        }).catch(() => {
          reject()
        })
      }).catch(() => {
        reject()
      })
    }).catch(() => {
      reject()
    })
  })
}

module.exports = {
  createConnection,
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
  updateUserProfile,
  seedTestData
}
