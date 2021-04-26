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
 * @param {string} roomCode
 * @returns {Promise<Object>}
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
 * @param {string} userId
 * @param {string} roomCode
 * @returns {Promise<Object>}
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
 * @param {string} userId
 * @param {string} roomCode
 * @returns {Promise<Object>}
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
 * @param {string} userId
 * @param {string} roomCode
 * @returns {Promise<Object>}
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
 * @param {string} roomId
 * @returns {Promise<Array<Object>>}
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
 * @param {{title: string, imageData: string, background: string}} message
 * @param {string} userId
 * @param {string} roomId
 * @returns {Promise<Object>}
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
 * @param {string} messageId
 * @returns {Promise}
 */
const deleteMessageById = (messageId) => {
  return Message.findByIdAndDelete(messageId)
}

/**
 * Get a user profile by profile id.
 * @param {string} userId
 * @returns {Promise<Object>}
 */
const getUserProfileById = (userId) => {
  return User.findById(userId, {
    name: 1,
    email: 1
  })
}

/**
 * Get a user profile by email.
 * @param {string} email
 * @returns {Promise<Object>}
 */
const getUserProfileByEmail = (email) => {
  return User.findOne({
    email: email
  })
}

/**
 * Create a user profile.
 * @param {string} name
 * @param {string} email
 * @param {string} hashedPassword
 * @returns {Promise<Object>}
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
      })
    }).catch((err) => {
      console.log(`Error creating user profile: ${err}`)
    })
  })
}

/**
 * Update a user profile by user id.
 * @param {string} userId
 * @param {{name: string?, email: string?, password: string?}} updatedProperties
 * @returns {Promise<Object>}
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
  updateUserProfile
}
