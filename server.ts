import { IRoom } from "./models/room"
import { IUpdatedUser } from "./models/updated-user"
import { IUser } from "./models/user"
import dotenv from 'dotenv'
import express from 'express'
import path from 'path'
import bodyParser from 'body-parser'
import cors from 'cors'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nanoid from 'nanoid'
import swaggerUi from 'swagger-ui-express'
import dbhelper from './dbhelper'
import { IMessageData } from "./models/message-data"
// const multer = require('multer')
// const fs = require('fs')

/**
 * Configure Express Server
 */
if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}
const app = express()
const staticFileMiddleware = express.static(path.resolve(__dirname) + '/dist')
app.use(staticFileMiddleware)
app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

// CORS setup
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(' ') : '*'
const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  exposedHeaders: ['origin', 'X-requested-with', 'Content-Type', 'Accept']
}

app.use(cors(corsOptions))

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

// TODO: figure out way to auto-generate documentation without using swaggerJSDoc, which was very messy.
// potentially using TSOA?
const swaggerSpec = {}
// const swaggerSpec = swaggerJSDoc(swaggerOptions)

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// connect to mongo and start web server if not a test
if (process.env.NODE_ENV !== 'test') {
  // connect to Mongo DB instance
  const connectionString: string = process.env.MONGO_URL || ''
  dbhelper.createConnection(connectionString)

  // start server
  const port = process.env.PORT || 5000
  app.listen(port)
  console.log('server started on port: ' + port)
}

/**
 * Set up logging method
 */
const logWithDate = (message: string, isError?: boolean) => {
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
 * Retrieve a simple test message from the server.
 */
app.get('/', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'GET')
  logWithDate(`@GET /`)
  return res.status(200).send('Welcome to doodle-mail!')
})

/**
 * View basic info for all rooms, not including message or user details. Only accessible in dev environment.
 */
app.get('/rooms/info', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'GET')
  logWithDate(`@GET /rooms/info`)
  if (process.env.NODE_ENV !== 'production') {
    dbhelper.getAllRoomInfo().then((rooms: Array<IRoom>) => {
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
 * View info for a specific room, including user names and message details.
 */
app.get('/rooms/:roomCode/info', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /rooms/${req.params.roomCode}/info`)
  if (req.params.roomCode != null) {
    logWithDate(`Finding room: ${req.params.roomCode}`)
    dbhelper.getRoomInfo(req.params.roomCode).then((room: IRoom | null) => {
      return res.status(200).send({
        room: room
      })
    }).catch((err: Error) => {
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
 * Create a new room and add the specified user to it, then return the room details.
 */
app.post('/rooms', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms`)
  if (req.body.userId != null) {
    // create a room with unique 4 char guid and add user to it
    const roomCode = nanoid.nanoid(4)
    logWithDate(`Creating room for user: ${req.body.userId} with code: ${roomCode}`)
    dbhelper.createRoom(req.body.userId, roomCode).then((room: IRoom) => {
      return res.status(200).send({
        room: room
      })
    }).catch((err: Error) => {
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
 * Add user to a room selected by room code, then return the room.
 */
// TODO: check if user is already in room before you add them
app.post('/rooms/:roomCode/join', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomCode}/join`)
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    logWithDate(`User ${req.body.userId} attempting to join room with code ${req.params.roomCode}`)
    // find room by roomCode, add user to it, and populate the array of users in room
    dbhelper.joinRoom(req.body.userId, req.params.roomCode).then((room: IRoom | null) => {
      // return data for room
      return res.status(200).send({
        room: room
      })
    }).catch((err: Error) => {
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
 * Remove user from room selected by room code.
 */
app.post('/rooms/:roomCode/leave', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomCode}/leave`)
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userId != null) {
    logWithDate(`User ${req.body.userId} attempting to leave room with code ${req.params.roomCode}`)
    // find room by code and leave it
    dbhelper.leaveRoom(req.body.userId, req.params.roomCode).then(() => {
      return res.sendStatus(200)
    }).catch((err: Error) => {
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
 * Gets all messages for the room by roomId, including all message and author details.
 */
app.get('/rooms/:roomId/messages', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /rooms/${req.params.roomId}/messages`)
  // get messages for a room by id
  dbhelper.getRoomMessages(req.params.roomId).then((room: IRoom | null) => {
    if (room != null && room.participants.includes(req.body.userId)) {
      logWithDate(`Getting messages for room ${req.params.roomId} for user ${req.body.userId}`)
      return res.status(200).send(room.messages)
    } else {
      logWithDate(`User ${req.body.userId} is not authorized to view messages for room ${req.params.roomId}`)
      return res.status(401).send({
        message: `You are not authorized to view this room's messages.`
      })
    }
  }).catch((err: Error) => {
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
app.post('/rooms/:roomId/messages', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomId}/messages`)
  let result: IRoom | null = null
  if (req.params.roomId != null && req.body.userId != null && req.body.messages != null) {
    logWithDate(`Sending message from user ${req.body.userId} to room ${req.params.roomId}`)
    // create message, then add it to a room
    const messageWrites = req.body.messages.map((message: IMessageData) => {
      return new Promise<void>((resolve, reject) => {
        // insert each message into DB collection
        dbhelper.sendMessageToRoom(message, req.body.userId, req.params.roomId)
          .then((room: IRoom | null) => {
            result = room
            resolve()
          })
          .catch((err: Error) => {
            logWithDate(`Error writing message from user ${req.body.userId} to room ${req.params.roomId}: ${err}`, true)
            reject()
          })
      })
    })
    Promise.all(messageWrites).then(() => {
      logWithDate(`Wrote all messages successfully.`)
      if (result != null) {
        return res.status(200).send(result.messages)
      }
      else {
        logWithDate(`Error writing messages to room.`)
        return res.status(400).send({
          message: `Failed to write messages to room.`
        })
      }
    }).catch((err: Error) => {
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
 * Delete message by messageId
 */
app.delete('/messages', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'DELETE')
  res.header('Content-Type', 'application/json')
  logWithDate(`@DELETE /messages`)
  if (req.body.messageId != null) {
    logWithDate(`Deleting message with id ${req.body.messageId}`)
    dbhelper.deleteMessageById(req.body.messageId)
      .then(() => {
        logWithDate(`Message deleted successfully`)
        return res.sendStatus(200)
      }).catch((err: Error) => {
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
app.get('/users/:userId', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  logWithDate(`@GET /users/${req.params.userId}`)
  dbhelper.getUserProfileById(req.params.userId)
    .then((user: IUser | null) => {
      logWithDate(`Retrieved data for user ${req.params.userId}`)
      return res.status(200).json({
        user: user
      })
    }).catch((err: Error) => {
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
app.post('/users', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /users`)
  if (req.body.email != null && req.body.name != null && req.body.password != null) {
    logWithDate(`Checking for existing account with email: ${req.body.email}`)
    // check if email is already in use
    dbhelper.getUserProfileByEmail(req.body.email)
      .then((user: IUser | null) => {
        // if there is a user, do not create account
        if (user != null) {
          logWithDate(`Duplicate email found. Account not created.`)
          return res.status(400).send({
            message: `The email address provided is already in use.`
          })
        }
        logWithDate(`Creating user ${req.body.name} with email ${req.body.password}`)
        // create new user
        bcrypt.hash(req.body.password, 8).then((hashedPassword: string) => {
          dbhelper.createUserProfile(req.body.name, req.body.email, hashedPassword)
            .then((user: IUser | null) => {
              if (user === null) {
                throw new Error(`User is null.`)
              }
              logWithDate(`Creating login token for newly created user`)
              const token = jwt.sign({
                id: user._id
              }, process.env.TOKEN_SECRET || '1234', {
                expiresIn: 86400 // expires in 24 hours
              })
              logWithDate(`Token created. User logged in.`)
              return res.status(200).send({
                auth: true,
                token: token,
                user: user
              })
            }).catch((err: Error) => {
              logWithDate(`Problem logging in user: ${err}`, true)
              return res.status(400).send({
                message: `There was a problem logging in user.`
              })
            })
        }).catch((err: Error) => {
          logWithDate(`There was a problem registering the user with email ${req.body.email}: ${err}`, true)
          return res.status(400).send({
            message: `There was a problem registering the user`
          })
        })
      }).catch((err: Error) => {
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
app.post('/users/login', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@/users/login`)
  if (req.body.email != null && req.body.password != null) {
    logWithDate(`Getting user profile by email ${req.body.email}`)
    dbhelper.getUserProfileByEmail(req.body.email).then((user: IUser | null) => {
      if (!user) {
        logWithDate(`No user found with that email`)
        return res.status(401).send({
          auth: false,
          token: null
        })
      }
      bcrypt.compare(req.body.password, user.password).then((passwordIsValid: boolean) => {
        logWithDate(`Comparing login details`)
        if (!passwordIsValid) {
          logWithDate(`Login info invalid`)
          return res.status(401).send({
            auth: false,
            token: null
          })
        }
        logWithDate(`Login info valid, generating token`)
        const token = jwt.sign({
          id: user._id
        }, process.env.TOKEN_SECRET || '1234', {
          expiresIn: 86400 // expires in 24 hours
        })
        logWithDate(`Token generated successfully and user logged in`)
        return res.status(200).send({
          auth: true,
          token: token,
          user: user
        })
      }).catch((err: Error) => {
        logWithDate(`Server error when attempting to decrypt password: ${err}`, true)
        return res.status(500).send({
          message: 'Server error'
        })
      })
    }).catch((err: Error) => {
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
app.put('/users', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'PUT')
  res.header('Content-Type', 'application/json')
  logWithDate(`@PUT /users`)
  if (req.body.userId != null && req.body.updatedProperties != null) {
    logWithDate(`Updating account with user id ${req.body.userId}`)
    // check if email is already in use
    logWithDate(`Checking if email ${req.body.updatedProperties.email} is already in use`)
    dbhelper.getUserProfileByEmail(req.body.email)
      .then((user: IUser | null) => {
        // if there is a user, do not create account
        if (user != null) {
          logWithDate(`Duplicate email found`)
          return res.status(400).send({
            message: `The email address provided is already in use.`
          })
        }
        // check new values for null, only include if not null
        const updated: IUpdatedUser = {}
        if (req.body.updatedProperties.name) updated.name = req.body.updatedProperties.name
        if (req.body.updatedProperties.email) updated.email = req.body.updatedProperties.email

        // if password is being updated, hash with bcrypt before doing update operation
        if (req.body.updatedProperties.password != undefined) {
          logWithDate('Updating password')
          bcrypt.hash(req.body.updatedProperties.password, 8)
            .then((hashedPassword: string) => {
              updated.password = hashedPassword
              // get user belonging to that context GUID and update their properties
              dbhelper.updateUserProfile(req.body.userId, updated)
                .then((user: IUser | null) => {
                  logWithDate(`User profile updated successfully`)
                  return res.status(200).send({
                    user: user
                  })
                }).catch((err: Error) => {
                  logWithDate(`Error updating user profile with id ${req.body.userId}: ${err}`, true)
                  return res.status(400).send({
                    message: `Failed to update account`
                  })
                })
            }).catch((err: Error) => {
              logWithDate(`Failed to update user account with id ${req.body.userId}: ${err}`, true)
              return res.status(400).send({
                message: `Failed to update account`
              })
            })
        } else {
          // get user belonging to that context GUID and update their properties
          dbhelper.updateUserProfile(req.body.userId, updated)
            .then((user: IUser | null) => {
              logWithDate(`User profile updated successfully`)
              return res.status(200).send({
                user: user
              })
            }).catch((err: Error) => {
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
// app.post('/uploadAvatar', upload.single('picture'), (req: express.Request, res: express.Response) => {
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

export default app
