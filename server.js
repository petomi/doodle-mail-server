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
const swaggerJSDoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
const dbhelper = require('./dbhelper')
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

// set up swagger documentation
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Doodle Mail API',
    version: '1.0.0',
    description: `This is the REST API for Doodle Mail, an application created with Express and MongoDB.
      It allows users to send pictures they draw on their devices to each other in a chat room environment.`,
    servers: [{
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://doodle-mail-server.herokuapp.com',
        description: 'Production server'
      }
    ]
  }
}

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./server.js']
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// connect to mongo and start web server if not a test
if (process.env.NODE_ENV !== 'test') {
  // connect to Mongo DB instance
  dbhelper.createConnection(process.env.MONGO_URL)

  // start server
  var port = process.env.PORT || 5000
  app.listen(port)
  console.log('server started on port: ' + port)
}

/**
 * Set up logging method
 */
const logWithDate = (message, isError) => {
  const currentTime = Date.now()
  if (isError) {
    console.error(`${currentTime}: ${message}`)
  } else {
    console.log(`${currentTime}: ${message}`)
  }
}


/**
 * API Routes
 */
// TODO - create Express API endpoint documentation from comments (automated?) - use swagger-ui and swagger-jsdoc
// TODO - fix failing automated tests on github (process.env variables are undefined)
// TODO - split out server configuration or routes into their own modules

/**
 * @swagger
 * /:
 *  get:
 *    summary: Retrieve a simple test message from the server.
 *    responses:
 *      200:
 *        description: A test message.
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: Welcome to doodle-mail!
 */
app.get('/', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  logWithDate(`@GET /`)
  return res.status(200).send('Welcome to doodle-mail!')
})

/**
 * @swagger
 * /rooms/info:
 *  get:
 *    summary: View info for all rooms.
 *    description: View basic info for all rooms, not including message or user details. Only accessible in dev environment.
 *    responses:
 *      200:
 *        description: An array of room objects.
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example:
 *                {
 *                  "rooms": [
 *                      {
 *                          "participants": [
 *                              "6083303610cd25158809b909"
 *                          ],
 *                          "messages": [
 *                              "608330e010cd25158809b90c"
 *                          ],
 *                          "_id": "6083307c10cd25158809b90b",
 *                          "entryCode": "cBSL",
 *                          "__v": 0
 *                      }
 *                   ]
 *                 }
 */
app.get('/rooms/info', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  logWithDate(`@GET /rooms/info`)
  if (process.env.NODE_ENV !== 'production') {
    dbhelper.getAllRoomInfo().then((rooms) => {
      return res.status(200).send({
        rooms: rooms
      })
    })
  } else {
    logWithDate(`Endpoint not allowed in production environment`)
    return res.status(200).send('Nice try :)')
  }
})

/**
 * @swagger
 * /rooms/:roomCode/info:
 *  get:
 *    summary: View info for a specific room.
 *    description: View info for a specific room, including user names and message details.
 *    parameters:
 *      - in: path
 *        name: roomCode
 *        required: true
 *        description: The 4 character alpha code that identifies rooms to a user.
 *        schema:
 *          type: string
 *    responses:
 *      200:
 *        description: A room object.
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example:
 *                {
 *                  "room": {
 *                    "participants": [
 *                      {
 *                        "_id": "6083303610cd25158809b909",
 *                          "name": "Michael Test",
 *                          "__v": 0
 *                      }
 *                    ],
 *                    "messages": [
 *                      {
 *                        "_id": "60870957094e2509b8671159",
 *                        "author": {
 *                            "_id": "6083303610cd25158809b909",
 *                            "name": "Michael Test",
 *                            "email": "test@test.com",
 *                            "password": "$2b$08$qbfD8ygxyDr0WKIQ1VSyueRNrjgy0upLq1RsYR.8/0tgTCcAbfIoC",
 *                            "__v": 0
 *                        },
 *                        "title": "Test Message 4",
 *                        "date": "1619462487946",
 *                        "imageData": "TALKJLASJD",
 *                        "background": "blue",
 *                        "__v": 0
 *                      }
 *                    ],
 *                    "_id": "6086f4f3c251c729b4a041a6",
 *                    "entryCode": "abcd",
 *                    "__v": 0
 *                  }
 *                }
 *      400:
 *       description: Bad request. Missing room code in URL or internal error.
 */
app.get('/rooms/:roomCode/info', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /rooms/${req.params.roomCode}/info`)
  if (req.params.roomCode != null) {
    logWithDate(`Finding room: ${req.params.roomCode}`)
    dbhelper.getRoomInfo(req.params.roomCode).then(function (room) {
      return res.status(200).send({
        room: room
      })
    }).catch((err) => {
      logWithDate(`Error finding room ${req.params.roomCode}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to get room info`
      })
    })
  } else {
    logWithDate(`Missing room code in URL`)
    return res.status(400).send()
  }
})

/**
 * @swagger
 * /rooms:
 *  post:
 *    summary: Create a new room.
 *    description: Create a new room and add the specified user to it, then return the room details.
 *    parameters:
 *      - in: body
 *        name: userId
 *        description: The user id of the user to add to the newly created room.
 *        schema:
 *          type: string
 *    responses:
 *      200:
 *        description: A room object.
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example:
 *                {
 *                  "room": {
 *                    "participants": [
 *                      "6083303610cd25158809b909"
 *                    ],
 *                    "messages": [],
 *                    "_id": "608ac3a16774c31aa8c8082b",
 *                    "entryCode": "kQ0g",
 *                    "__v": 0
 *                  }
 *                }
 *      400:
 *        description: Bad Request. Missing userId in request body or other error.
 */
app.post('/rooms', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms`)
  if (req.body.userId != null) {
    // create a room with unique 4 char guid and add user to it
    const roomCode = nanoid.nanoid(4)
    logWithDate(`Creating room for user: ${req.body.userId} with code: ${roomCode}`)
    dbhelper.createRoom(req.body.userId, roomCode).then(function (room) {
      return res.status(200).send({
        room: room
      })
    }).catch((err) => {
      logWithDate(`Failed to create room for user ${req.body.userId}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to create new room`
      })
    })
  } else {
    // throw error if data is incomplete.
    logWithDate(`Missing userId in request body`)
    return res.status(400).send()
  }
})


/**
 * @swagger
 * /rooms/:roomCode/join:
 *  post:
 *    summary: Join a room by room code.
 *    description: Add user to a room selected by room code, then return the room.
 *    parameters:
 *      - in: path
 *        name: roomCode
 *        required: true
 *        description: The 4 character alpha code that identifies rooms to a user.
 *        schema:
 *          type: string
 *      - in: body
 *        name: userId
 *        description: The user id of the user to add to the newly created room.
 *        schema:
 *          type: string
 *    responses:
 *      200:
 *        description: A room object.
 *        content:
 *          application/json:
 *            schema:
 *              type: string
 *              example:
 *                {
 *                  "room": {
 *                      "participants": [
 *                        {
 *                          "_id": "6083303610cd25158809b909",
 *                          "name": "Michael Test",
 *                          "__v": 0
 *                        }
 *                      ],
 *                      "messages": [],
 *                      "_id": "6086f4f3c251c729b4a041a6",
 *                      "entryCode": "vnOk",
 *                      "__v": 0
 *                  }
 *                }
 *      400:
 *        description: Bad Request. Missing roomCode in URL params or userId in request body, or user already exists in room.
 */
// TODO: check if user is already in room before you add them
app.post('/rooms/:roomCode/join', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomCode}/join`)
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    logWithDate(`User ${req.body.userId} attempting to join room with code ${req.params.roomCode}`)
    // find room by roomCode, add user to it, and populate the array of users in room
    dbhelper.joinRoom(req.body.userId, req.params.roomCode).then((room) => {
      // return data for room
      return res.status(200).send({
        room: room
      })
    }).catch(err => {
      logWithDate(`Failed to add user ${req.body.userId} to room ${req.params.roomCode}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to add user to room`
      })
    })
  } else {
    logWithDate(`Missing roomCode in URL params or userId in request body`)
    // throw error if data is incomplete.
    return res.status(400).send()
  }
})

/**
 * @swagger
 * /rooms/:roomCode/leave:
 *  post:
 *    summary: Leave a room by room code.
 *    parameters:
 *      - in: path
 *        name: roomCode
 *        required: true
 *        description: The 4 character alpha code that identifies rooms to a user.
 *        schema:
 *          type: string
 *      - in: body
 *        name: userId
 *        description: The user id of the user to add to the newly created room.
 *        schema:
 *          type: string
 *    description: Remove user from room selected by room code.
 *    responses:
 *      200:
 *        description: An OK response.
 *      400:
 *        description: Bad Request. Missing roomCode in URL parameters or userId in request body, or user does not exist in room.
 */
app.post('/rooms/:roomCode/leave', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomCode}/leave`)
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    logWithDate(`User ${req.body.userId} attempting to leave room with code ${req.params.roomCode}`)
    // find room by code and leave it
    dbhelper.leaveRoom(req.body.userId, req.params.roomCode).then(() => {
      return res.sendStatus(200)
    }).catch((err) => {
      logWithDate(`Failed to remove user ${req.body.userId} from room ${req.params.roomCode}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to remove user from room`
      })
    })
  } else {
    logWithDate(`Missing roomCode in URL parameters or userId in request body`)
    // throw error if data is incomplete
    return res.status(400).send()
  }
})

/**
 * @swagger
 * /rooms/:roomId/messages:
 *   get:
 *     summary: Gets all messages for the room by roomId
 *     parameters:
 *       - in: path
 *         name: roomCode
 *         required: true
 *         description: The 4 character alpha code that identifies rooms to a user.
 *         schema:
 *           type: string
 *       - in: body
 *         name: userId
 *         description: The user id of the user to add to the newly created room.
 *         schema:
 *           type: string
 *     description: Gets all messages for the room by roomId, including all message and author details.
 *     responses:
 *       200:
 *         description: An array of message objects.
 *         content:
 *           application/json:
 *             schema:
 *               type: string
 *               example:
 *                 [
 *                   {
 *                       "_id": "60870957094e2509b8671159",
 *                       "author": {
 *                           "_id": "6083303610cd25158809b909",
 *                           "name": "Michael Test",
 *                           "__v": 0
 *                       },
 *                       "title": "Test Message 4",
 *                       "date": "1619462487946",
 *                       "imageData": "TALKJLASJD",
 *                       "background": "blue",
 *                       "__v": 0
 *                   }
 *                 ]
 *       400:
 *         description: Bad Request. Missing roomId in URL params or userId in request body, or user already exists in room.
 */
app.get('/rooms/:roomId/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /rooms/${req.params.roomId}/messages`)
  // get messages for a room by id
  dbhelper.getRoomMessages(req.params.roomId).then((room) => {
    if (room.participants.includes(req.body.userId)) {
      logWithDate(`Getting messages for room ${req.params.roomId} for user ${req.body.userId}`)
      return res.status(200).send(room.messages)
    } else {
      logWithDate(`User ${req.body.userId} is not authorized to view messages for room ${req.params.roomId}`)
      return res.status(401).send({
        message: `You are not authorized to view this room's messages.`
      })
    }
  }).catch((err) => {
    logWithDate(`Unable to retrieve messages for room ${req.params.roomId} for user ${req.body.userId}: ${err}`, true)
    return res.status(400).send({
      message: `Unable to retrieve room messages`
    })
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
  logWithDate(`@POST /rooms/${req.params.roomId}/messages`)
  let result = null
  if (req.params.roomId != null && req.body.userId != null && req.body.messages != null) {
    logWithDate(`Sending message from user ${req.body.userId} to room ${req.params.roomId}`)
    // create message, then add it to a room
    let messageWrites = req.body.messages.map((message) => {
      return new Promise((resolve, reject) => {
        // insert each message into DB collection
        dbhelper.sendMessageToRoom(message, req.body.userId, req.params.roomId)
          .then((room) => {
            result = room
            resolve()
          })
          .catch((err) => {
            logWithDate(`Error writing message from user ${req.body.userId} to room ${req.params.roomId}: ${err}`, true)
            reject()
          })
      })
    })
    Promise.all(messageWrites).then(() => {
      logWithDate(`Wrote all messages successfully.`)
      return res.status(200).send(result.messages)
    }).catch((err) => {
      logWithDate(`Failed to send messages from user ${req.body.userId} to room ${req.params.roomId}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to send message to room`
      })
    })
  } else {
    logWithDate(`Missing roomId in URL params or userId, messages objects in request body`)
    return res.status(400).send()
  }
})

/**
 * Delete a message by message id
 */
app.delete('/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'DELETE')
  res.header('Content-Type', 'application/json')
  logWithDate(`@DELETE /messages`)
  if (req.body.messageId != null) {
    logWithDate(`Deleting message with id ${req.body.messageId}`)
    dbhelper.deleteMessageById(req.body.messageId)
      .then(() => {
        logWithDate(`Message deleted successfully`)
        return res.sendStatus(200)
      }).catch((err) => {
        logWithDate(`Failed to delete message with id ${req.body.messageId}: ${err}`, true)
        return res.status(400).send({
          message: `Failed to delete message`
        })
      })
  } else {
    logWithDate(`Missing messageId in request body`)
    return res.status(400).send()
  }
})

/**
 * Return all user profile info
 */
app.get('/users/:userId', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /users/${req.params.userId}`)
  dbhelper.getUserProfileById(req.params.userId)
    .then((doc) => {
      logWithDate(`Retrieved data for user ${req.params.userId}`)
      return res.status(200).json({
        user: doc
      })
    }).catch((err) => {
      logWithDate(`Unable to get data for user ${req.params.userId}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to get user`
      })
    })
})

/**
 * Create a new user account
 * Takes in an object containing name, email, and password fields
 */
app.post('/users', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /users`)
  if (req.body.email != null && req.body.name != null && req.body.password != null) {
    logWithDate(`Checking for existing account with email: ${req.body.email}`)
    // check if email is already in use
    dbhelper.getUserProfileByEmail(req.body.email)
      .then((user) => {
        // if there is a user, do not create account
        if (user != null) {
          logWithDate(`Duplicate email found. Account not created.`)
          return res.status(400).send({
            message: `The email address provided is already in use.`
          })
        }
        logWithDate(`Creating user ${req.body.name} with email ${req.body.password}`)
        // create new user
        bcrypt.hash(req.body.password, 8).then((hashedPassword) => {
          dbhelper.createUserProfile(req.body.name, req.body.email, hashedPassword)
            .then((user) => {
              logWithDate(`Creating login token for newly created user`)
              let token = jwt.sign({
                id: user._id
              }, process.env.TOKEN_SECRET, {
                expiresIn: 86400 // expires in 24 hours
              })
              logWithDate(`Token created. User logged in.`)
              return res.status(200).send({
                auth: true,
                token: token,
                user: user
              })
            }).catch((err) => {
              logWithDate(`Problem logging in user: ${err}`, true)
              return res.status(400).send({
                message: `There was a problem logging in user.`
              })
            })
        }).catch((err) => {
          logWithDate(`There was a problem registering the user with email ${req.body.email}: ${err}`, true)
          return res.status(400).send({
            message: `There was a problem registering the user`
          })
        })
      }).catch((err) => {
        logWithDate(`Unable to search for existing user with email ${req.body.email}: ${err}`, true)
        return res.status(400).send({
          message: `Unable to search for existing user`
        })
      })
  } else {
    return res.status(400).send()
  }
})

/**
 * Log user in and provide with auth token
 * Takes in object with email and password
 */
app.post('/users/login', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@/users/login`)
  if (req.body.email != null && req.body.password != null) {
    logWithDate(`Getting user profile by email ${req.body.email}`)
    dbhelper.getUserProfileByEmail(req.body.email).then((doc) => {
      if (!doc) {
        logWithDate(`No user found with that email`)
        return res.status(401).send({
          auth: false,
          token: null
        })
      }
      bcrypt.compare(req.body.password, doc.password).then((passwordIsValid) => {
        logWithDate(`Comparing login details`)
        if (!passwordIsValid) {
          logWithDate(`Login info invalid`)
          return res.status(401).send({
            auth: false,
            token: null
          })
        }
        logWithDate(`Login info valid, generating token`)
        let token = jwt.sign({
          id: doc._id
        }, process.env.TOKEN_SECRET, {
          expiresIn: 86400 // expires in 24 hours
        })
        logWithDate(`Token generated successfully and user logged in`)
        return res.status(200).send({
          auth: true,
          token: token,
          user: doc
        })
      }).catch((err) => {
        logWithDate(`Server error when attempting to decrypt password: ${err}`, true)
        return res.status(500).send({
          message: 'Server error'
        })
      })
    }).catch((err) => {
      logWithDate(`Error logging in: ${err}`, true)
      return res.status(400).send({
        message: 'Error logging in'
      })
    })
  } else {
    logWithDate(`Missing email or password from request body`)
    return res.status(400).send()
  }
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
  logWithDate(`@PUT /users`)
  if (req.body.userId != null && req.body.updatedProperties != null) {
    logWithDate(`Updating account with user id ${req.body.userId}`)
    // check if email is already in use
    logWithDate(`Checking if email ${req.body.updatedProperties.email} is already in use`)
    dbhelper.getUserProfileByEmail(req.body.email)
      .then((user) => {
        // if there is a user, do not create account
        if (user != null) {
          logWithDate(`Duplicate email found`)
          return res.status(400).send({
            message: `The email address provided is already in use.`
          })
        }
        // check new values for null, only include if not null
        let updated = {}
        if (req.body.updatedProperties.name) updated.name = req.body.updatedProperties.name
        if (req.body.updatedProperties.email) updated.email = req.body.updatedProperties.email

        // if password is being updated, hash with bcrypt before doing update operation
        if (req.body.updatedProperties.password != undefined) {
          logWithDate('Updating password')
          bcrypt.hash(req.body.updatedProperties.password, 8)
            .then((hashedPassword) => {
              updated.password = hashedPassword
              // get user belonging to that context GUID and update their properties
              dbhelper.updateUserProfile(req.body.userId, updated)
                .then((user) => {
                  logWithDate(`User profile updated successfully`)
                  return res.status(200).send({
                    user: user
                  })
                }).catch((err) => {
                  logWithDate(`Error updating user profile with id ${req.body.userId}: ${err}`, true)
                  return res.status(400).send({
                    message: `Failed to update account`
                  })
                })
            }).catch((err) => {
              logWithDate(`Failed to update user account with id ${req.body.userId}: ${err}`, true)
              return res.status(400).send({
                message: `Failed to update account`
              })
            })
        } else {
          // get user belonging to that context GUID and update their properties
          dbhelper.updateUserProfile(req.body.userId, updated)
            .then((user) => {
              logWithDate(`User profile updated successfully`)
              return res.status(200).send({
                user: user
              })
            }).catch((err) => {
              logWithDate(`Failed to update user profile with id ${req.body.userId}: ${err}`, true)
              return res.status(400).send({
                message: `Failed to update account`
              })
            })
        }
      })
  } else {
    logWithDate(`Missing either userId or updatedProperties in request body`)
    return res.status(400).send()
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
