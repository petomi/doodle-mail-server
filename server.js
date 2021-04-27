// Setup
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}
const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nanoid = require('nanoid')
const dbhelper = require('./dbhelper')
const { resolve } = require('path')
// const multer = require('multer')
// const fs = require('fs')

/**
 * Configure Express Server
 */
const app = express()
const staticFileMiddleware = express.static(path.resolve(__dirname) + '/dist')
app.use(staticFileMiddleware)
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

// CORS setup
var allowedOrigins = process.env.ALLOWED_ORIGINS.split(' ')
// let allowedOrigins = '*'
app.use(cors({
  origin: function (origin, callback) {
    if (process.env.NODE_ENV !== 'production') {
      // allow requests with no origin
      // (like mobile apps or curl requests)
      if (!origin) return callback(null, true)
    } else {
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg = 'The CORS policy for this site does not ' +
          'allow access from the specified Origin.'
        return callback(new Error(msg), false)
      }
    }
    return callback(null, true)
  },
  credentials: true,
  exposedHeaders: ['origin', 'X-requested-with', 'Content-Type', 'Accept']
}))

// keep tests from overwriting real data - TODO: use in memory DB in future to avoid this
if (process.env.NODE_ENV !== 'test') {
  // connect to Mongo DB instance
  dbhelper.createConnection(process.env.MONGO_URL)

  // start server
  var port = process.env.PORT || 5000
  app.listen(port)
  console.log('server started on port: ' + port)
}

/**
 * API Routes
 */

// TODO - add logging to all endpoints
// TODO - add unit tests with supertest + jest
// TODO - create Express API endpoint documentation from comments (automated?)
// TODO - create automated test runs using CI before pushing to heroku
// TODO - Create README with basic instructions and add CI tag to github repo readme
// TODO - update client with all changes

// home/test page
app.get('/', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.status(200).send('Welcome to doodle-mail!')
})

/**
 * Get all room basic info (only accessible in dev environment)
 */
app.get('/rooms/info', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  if (process.env.NODE_ENV !== 'production') {
    dbhelper.getAllRoomInfo().then((rooms) => {
      res.status(200).send({
        rooms: rooms
      })
    })
  } else {
    res.status(200).send('Nice try :)')
  }
})

/**
 * Get specific room info, including messages
 */
app.get('/rooms/:roomCode/info', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  if (req.params.roomCode != null) {
    console.log(`Finding room: ${req.params.roomCode}`)
    dbhelper.getRoomInfo(req.params.roomCode).then(function (room) {
      res.status(200).send({
        room: room
      })
    }).catch((err) => {
      res.status(400).send(`Failed to get room info: ${err.message}`)
    })
  } else {
    res.status(400).send()
  }
})

/**
 * Create a new room
 */
app.post('/rooms', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  if (req.body.userId != null) {
    // create a room with unique 4 char guid and add user to it
    const roomCode = nanoid.nanoid(4)
    dbhelper.createRoom(req.body.userId, roomCode).then(function (room) {
      res.status(200).send({
        room: room
      })
    }).catch((err) => {
      res.status(400).send(`Failed to create new room: ${err.message}`)
    })
  } else {
    // throw error if data is incomplete.
    res.status(400).send()
  }
})


/**
 * Join room using access code
 */
app.post('/rooms/:roomCode/join', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    // find room by roomCode, add user to it, and populate the array of users in room
    dbhelper.joinRoom(req.body.userId, req.params.roomCode).then((room) => {
      // return data for room
      res.status(200).send({
        room: room
      })
    }).catch(err => {
      res.status(400).send(`Failed to add user to room: ${err.message}`)
    })
  } else {
    // throw error if data is incomplete.
    res.status(400).send()
  }
})

/**
 * Leave a room by access code
 */
app.post('/rooms/:roomCode/leave', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    // find room by code and leave it
    dbhelper.leaveRoom(req.body.userId, req.params.roomCode).then(() => {
      res.sendStatus(200)
    }).catch((err) => {
      res.status(400).send(`Failed to remove user from room: ${err.message}`)
    })
  } else {
    // throw error if data is incomplete
    res.status(400).send()
  }
})

/**
 * Pull all messages for the room by room id (not room code!)
 */
app.get('/rooms/:roomId/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  // get messages for a room by id
  dbhelper.getRoomMessages(req.params.roomId).then((room) => {
    if (room.participants.includes(req.body.userId)) {
      res.status(200).send(room.messages)
    } else {
      res.status(400).send(`You are not authorized to view this room's messages.`)
    }
  }).catch((err) => {
    res.status(400).send(`Unable to retrieve room messages: ${err.message}`)
  })
})

/**
 * Write a message to a room by room id.
 * Returns list of room messages.
 * Requires fields: user, message: { title, imageData, background }
 */
app.post('/rooms/:roomId/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  let result = null
  // create message, then add it to a room
  let messageWrites = req.body.messages.map((message) =>  {
    return new Promise((resolve, reject) => {
      // insert each message into DB collection
      dbhelper.sendMessageToRoom(message, req.body.userId, req.params.roomId)
      .then((room) => {
        result = room
        resolve()
      })
      .catch((err) => {
        console.log(`Error writing message to room: ${err.message}`)
        reject()
      })
    })
  })
  Promise.all(messageWrites).then(() => {
    res.status(200).send(result.messages)
  }).catch((err) => {
    res.status(400).send(`Failed to send message to room: ${err.message}`)
  })
})

/**
 * Delete a message by message id
 */
app.delete('/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'DELETE')
  res.header('Content-Type', 'application/json')
  dbhelper.deleteMessageById(req.body.messageId)
    .then(() => {
      res.sendStatus(200)
    }).catch((err) => {
      res.status(400).send(`Failed to delete message: ${err.message}`)
    })
})

/**
 * Return all user profile info
 */
app.get('/users/:userId', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  dbhelper.getUserProfileById(req.params.userId)
    .then((doc) => {
      return res.status(200).json({
        user: doc
      })
    }).catch((err) => {
      res.status(400).send(`Failed to get user: ${err.message}`)
    })
})

/**
 * Create a new user account
 * Takes in an object containing name, email, and password fields
 */
// TODO: check for duplicate user names and emails before allowing signup
app.post('/users', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // create new user
  bcrypt.hash(req.body.password, 8).then((hashedPassword) => {
    dbhelper.createUserProfile(req.body.name, req.body.email, hashedPassword)
      .then((user) => {
        let token = jwt.sign({
          id: user._id
        }, process.env.TOKEN_SECRET, {
          expiresIn: 86400 // expires in 24 hours
        })
        res.status(200).send({
          auth: true,
          token: token,
          user: user
        })
      }).catch((err) => {
        console.log(err)
        return res.status(400).send(`There was a problem logging in user.`)
      })
  }).catch((err) => {
    console.log(err)
    return res.status(400).send(`There was a problem registering the user: ${err}`)
  })
})

/**
 * Log user in and provide with auth token
 * Takes in object with email and password
 */
app.post('/users/login', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  dbhelper.getUserProfileByEmail(req.body.email).then((doc) => {
    if (!doc) {
      return res.status(404).send('No user found.')
    }
    bcrypt.compare(req.body.password, doc.password).then((passwordIsValid) => {
      if (!passwordIsValid) {
        return res.status(401).send({
          auth: false,
          token: null
        })
      }
      let token = jwt.sign({
        id: doc._id
      }, process.env.TOKEN_SECRET, {
        expiresIn: 86400 // expires in 24 hours
      })
      res.status(200).send({
        auth: true,
        token: token,
        user: doc
      })
    }).catch((err) => {
      console.log(err)
      return res.status(500).send('Server error.')
    })
  }).catch((err) => {
    console.log(err)
    return res.status(400).send('Error logging in.')
  })
})

/**
 * Edit account details
 * Takes in object with id, updatedProperties { email?, password? }
 */
// TODO: add photo upload using mongoose + multer
// update user account details (as many as are passed in)
app.put('/users', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'PUT')
  res.header('Content-Type', 'application/json')
  // check new values for null, only include if not null
  let updated = {}
  if (req.body.updatedProperties.name) updated.name = req.body.updatedProperties.name
  if (req.body.updatedProperties.email) updated.email = req.body.updatedProperties.email

  // if password is being updated, hash with bcrypt before doing update operation
  if (req.body.updatedProperties.password) {
    bcrypt.hash(req.body.updatedProperties.password, 8)
      .then((hashedPassword) => {
        updated.password = hashedPassword
        // get user belonging to that context GUID and update their properties
        dbhelper.updateUserProfile(req.body.userId, updated).then(() => {
          res.sendStatus(200)
        }).catch((err) => {
          res.status(400).send(`Failed to update account: ${err.message}`)
        })
      }).catch((err) => {
        res.status(400).send(`Failed to update account: ${err.message}`)
      })

  } else {
    // get user belonging to that context GUID and update their properties
    dbhelper.updateUserProfile(req.body.id, updated).then(() => {
      res.sendStatus(200)
    }).catch((err) => {
      res.status(400).send(`Failed to update account: ${err.message}`)
    })
  }
})

// // upload avatar
// app.post('/uploadAvatar', upload.single('picture'), (req, res) => {
//   var img = fs.readFileSynce(req.file.path)
//   var encode_image = img.toString('base64')
//   var finalimg = {
//     contentType: req.file.mimetype,
//     image: new Buffer(encode_image, 'base64')
//   }
//   User.
//   const file = req.file
//   if (!file) {
//     res.status(400).send('Pleasae upload a file.')
//   }
//   res.status(200).send()
// })

module.exports = app
