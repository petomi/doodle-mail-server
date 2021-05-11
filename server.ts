import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import bodyParser from 'body-parser'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import YAML from 'yamljs'
import dbhelper from './helpers/dbhelper'
import logWithDate from './helpers/loghelper'
import { IRoom } from "./models/room"
import { IMessageData } from "./models/message-data"
import { IMessage } from "./models/message"

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

const swaggerSpec = YAML.load('./swagger.yaml')

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
// create server and websocket
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins
  }
})

// connect to mongo and start web server if not a test
if (process.env.NODE_ENV !== 'test') {
  // connect to Mongo DB instance
  const connectionString: string = process.env.MONGO_URL || ''
  dbhelper.createConnection(connectionString)

  // start server
  const port = process.env.PORT || 5000
  server.listen(port, () => {
    console.log('server started on port: ' + port)
  })
  // Web Socket listener
  io.on('connection', (socket) => {
    console.log('a user connected')

    // TODO: migrate REST routes here, see https://socket.io/get-started/basic-crud-application/
    // see also https://socket.io/get-started/private-messaging-part-1/#Review

    socket.on('disconnect', () => {
      console.log('user disconnected.')
      // TODO - remove user from room
    })
  })
}



/**
 * API Routes
 */

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
app.post('/rooms', async function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms`)
  if (req.body.userName != null) {
    // generate room code
    logWithDate(`Generating unique 4 digit room code`)
    const roomCode: string = await dbhelper.generateUniqueRoomCode()
    logWithDate(`Creating room for user: ${req.body.userName} with code: ${roomCode}`)
    // create room in db
    dbhelper.createRoom(req.body.userName, roomCode).then((room: IRoom) => {
      return res.status(200).send({
        room: room
      })
    }).catch((err: Error) => {
      logWithDate(`Failed to create room for user ${req.body.userName}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to create new room`
      })
    })
  } else {
    // throw error if data is incomplete.
    logWithDate(`Missing userName in request body`)
    return res.status(400).send()
  }
})

/**
 * Add user to a room selected by room code, then return the room.
 */
app.post('/rooms/:roomCode/join', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  logWithDate(`@POST /rooms/${req.params.roomCode}/join`)
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.userName != null) {
    logWithDate(`User ${req.body.userName} attempting to join room with code ${req.params.roomCode}`)
    dbhelper.getRoomInfo(req.params.roomCode).then((room) => {
      if (room == null) {
        logWithDate(`Failed to add user ${req.body.userName} to room ${req.params.roomCode}: room is null`)
        return res.status(400).send({
          message: `Room does not exist.`
        })
      }
      // check name against existing room occupants
      if (room.participants.includes(req.body.userName)) {
        logWithDate(`User ${req.body.userName} already exists in room ${req.params.roomCode}`)
        return res.status(400).send({
          message: `Someone with same name is already in room.`
        })
      }
      // find room by roomCode, add user to it, and populate the array of users in room
      dbhelper.joinRoom(req.body.userName, req.params.roomCode).then((room: IRoom | null) => {
        logWithDate(`Joined room successfully.`)
        // return data for room
        return res.status(200).send({
          room: room
        })
      }).catch((err: Error) => {
        logWithDate(`Failed to add user ${req.body.userName} to room ${req.params.roomCode}: ${err}`, true)
        return res.status(400).send({
          message: `Failed to add user to room.`
        })
      })
    }).catch((err: Error) => {
      logWithDate(`Failed to add user ${req.body.userName} to room ${req.params.roomCode}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to add user to room.`
      })
    })

  } else {
    logWithDate(`Missing roomCode in URL params or userName in request body`)
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
  if (req.params.roomCode != null && req.body.userName != null) {
    logWithDate(`User ${req.body.userName} attempting to leave room with code ${req.params.roomCode}`)
    // find room by code and leave it
    dbhelper.leaveRoom(req.body.userName, req.params.roomCode).then(() => {
      return res.sendStatus(200)
    }).catch((err: Error) => {
      logWithDate(`Failed to remove user ${req.body.userName} from room ${req.params.roomCode}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to remove user from room`
      })
    })
  } else {
    logWithDate(`Missing roomCode in URL parameters or userName in request body`)
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
    if (room != null) {
      logWithDate(`Getting messages for room ${req.params.roomId}`)
      return res.status(200).send(room.messages)
    }
    return res.status(400).send({
      message: `Room ${req.params.roomId} does not exist`
    })
  }).catch((err: Error) => {
    logWithDate(`Unable to retrieve messages for room ${req.params.roomId}: ${err}`, true)
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
  if (req.params.roomId != null && req.body.userName != null && req.body.messages != null) {
    logWithDate(`Sending message from user ${req.body.userName} to room ${req.params.roomId}`)
    // create message, then add it to a room
    const messageWrites = req.body.messages.map((message: IMessageData) => {
      return new Promise<void>((resolve, reject) => {
        // insert each message into DB collection
        dbhelper.sendMessageToRoom(message, req.body.userName, req.params.roomId)
          .then((room: IRoom | null) => {
            result = room
            resolve()
          })
          .catch((err: Error) => {
            logWithDate(`Error writing message from user ${req.body.userName} to room ${req.params.roomId}: ${err}`, true)
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
      logWithDate(`Failed to send messages from user ${req.body.userName} to room ${req.params.roomId}: ${err}`, true)
      return res.status(400).send({
        message: `Failed to send message to room`
      })
    })
  } else {
    logWithDate(`Missing roomId in URL params or userName, messages objects in request body`)
    return res.status(400).send()
  }
})

/**
 * Delete message by messageId
 */
app.delete('/rooms/:roomId/messages', function (req: express.Request, res: express.Response) {
  res.header('Access-Control-Allow-Methods', 'DELETE')
  res.header('Content-Type', 'application/json')
  logWithDate(`@DELETE /messages`)
  if (req.body.messageId != null) {
    logWithDate(`Deleting message with id ${req.body.messageId} from room ${req.params.roomId}`)
    dbhelper.deleteMessageById(req.body.messageId).then(() => {
        dbhelper.getRoomMessages(req.params.roomId).then((room: IRoom | null) => {
          logWithDate(`Message deleted successfully`)
          const messages: IMessage[] = (room != null) ? room.messages : []
          return res.status(200).send(messages)
        }).catch((err: Error) => {
          logWithDate(`Failed to retrieve messages for room ${req.params.roomId}: ${err}`, true)
          return res.status(400).send({
            message: `Failed to get room messages.`
          })
        })
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

export default app
