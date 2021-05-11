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

// start server
const port = process.env.PORT || 5000
server.listen(port, () => {
  console.log('server started on port: ' + port)
})

// connect to mongo if not a test
if (process.env.NODE_ENV !== 'test') {
  // connect to Mongo DB instance
  const connectionString: string = process.env.MONGO_URL || ''
  dbhelper.createConnection(connectionString)
}


// Web Socket listener
  io.on('connection', (socket) => {
    console.log('User joined.')
    socket.emit('welcome', 'test payload')

    // TODO: migrate REST routes here, see https://socket.io/get-started/basic-crud-application/
    // see also https://socket.io/get-started/private-messaging-part-1/#Review
    socket.on('rooms:info', () => {
      logWithDate(`@GET /rooms/info`)
      if (process.env.NODE_ENV !== 'production') {
        dbhelper.getAllRoomInfo().then((rooms: Array<IRoom>) => {
          socket.emit('room', {
            rooms: rooms
          })
        })
      } else {
        logWithDate(`Endpoint not allowed in production environment`)
        socket.emit('error', {
          message: 'Nice try :)'
        })
      }
    })

    socket.on('rooms:info', (roomCode) => {
      logWithDate(`@GET /rooms/${roomCode}/info`)
      if (roomCode != null) {
        logWithDate(`Finding room: ${roomCode}`)
        dbhelper.getRoomInfo(roomCode).then((room: IRoom | null) => {
          socket.emit('room', {
            room: room
          })
        }).catch((err: Error) => {
          logWithDate(`Error finding room ${roomCode}: ${err}`, true)
          socket.emit('error', {
            message: `Failed to get room info`
          })
        })
      } else {
        logWithDate(`Missing room code in request`)
        socket.emit('error', {
          message: `Missing room code in request`
        })
      }
    })
    // TODO: emit to specific user who sent it only
    // TODO: get username from auth instead
    socket.on('rooms:create', async (userName) => {
      logWithDate(`@POST /rooms`)
      if (userName != null) {
        // generate room code
        logWithDate(`Generating unique 4 digit room code`)
        const roomCode: string = await dbhelper.generateUniqueRoomCode()
        logWithDate(`Creating room for user: ${userName} with code: ${roomCode}`)
        // create room in db
        dbhelper.createRoom(userName, roomCode).then((room: IRoom) => {
          socket.emit('room', {
            room: room
          })
        }).catch((err: Error) => {
          logWithDate(`Failed to create room for user ${userName}: ${err}`, true)
          socket.emit('error', {
            message: `Failed to create new room`
          })
        })
      } else {
        // throw error if data is incomplete.
        logWithDate(`Missing userName in request body`)
        socket.emit('error', {
          message: `Missing userName in request body`
        })
      }
    })

    // TODO: keep changing callbacks to socket.emits

    // TODO: emit to specific user who sent it only
    // TODO: get username from auth instead
    socket.on('rooms:join', (roomCode, userName, callback) => {
      logWithDate(`@POST /rooms/${roomCode}/join`)
      // join an existing room using a code
      if (roomCode != null && userName != null) {
        logWithDate(`User ${userName} attempting to join room with code ${roomCode}`)
        dbhelper.getRoomInfo(roomCode).then((room) => {
          if (room == null) {
            logWithDate(`Failed to add user ${userName} to room ${roomCode}: room is null`)
            return callback({
              status: 'error',
              message: `Room does not exist.`
            })
          }
          // check name against existing room occupants
          if (room.participants.includes(userName)) {
            logWithDate(`User ${userName} already exists in room ${roomCode}`)
            return callback({
              status: 'error',
              message: `Someone with same name is already in room.`
            })
          }
          // find room by roomCode, add user to it, and populate the array of users in room
          dbhelper.joinRoom(userName, roomCode).then((room: IRoom | null) => {
            logWithDate(`Joined room successfully.`)
            // return data for room
            return callback({
              status: 'ok',
              room: room
            })
          }).catch((err: Error) => {
            logWithDate(`Failed to add user ${userName} to room ${roomCode}: ${err}`, true)
            return callback({
              status: 'error',
              message: `Failed to add user to room.`
            })
          })
        }).catch((err: Error) => {
          logWithDate(`Failed to add user ${userName} to room ${roomCode}: ${err}`, true)
          return callback({
            status: 'error',
            message: `Failed to add user to room.`
          })
        })
      } else {
        logWithDate(`Missing roomCode in URL params or userName in request body`)
        // throw error if data is incomplete.
        return callback({
          status: 'error',
          message: `Missing roomCode in URL params or userName in request body`
        })
      }
    })

    // TODO: emit to specific user who sent it only
    // TODO: get username from auth instead
    socket.on('rooms:leave', (roomCode, userName, callback) => {
      logWithDate(`@POST /rooms/${roomCode}/leave`)
      // join an existing room using a code
      if (roomCode != null && userName != null) {
        logWithDate(`User ${userName} attempting to leave room with code ${roomCode}`)
        // find room by code and leave it
        dbhelper.leaveRoom(userName, roomCode).then(() => {
          return callback({
            status: 'ok'
          })
        }).catch((err: Error) => {
          logWithDate(`Failed to remove user ${userName} from room ${roomCode}: ${err}`, true)
          return callback({
            status: 'error',
            message: `Failed to remove user from room`
          })
        })
      } else {
        logWithDate(`Missing roomCode in URL parameters or userName in request body`)
        // throw error if data is incomplete
        return callback({
          status: 'error',
          message: `Missing roomCode in URL parameters or userName in request body`
        })
      }
    })

    // TODO: emit to specific user who sent it only
    socket.on('rooms:messages', (roomId, callback) => {
      logWithDate(`@GET /rooms/${roomId}/messages`)
      // get messages for a room by id
      dbhelper.getRoomMessages(roomId).then((room: IRoom | null) => {
        if (room != null) {
          logWithDate(`Getting messages for room ${roomId}`)
          return callback({
            status: 'ok',
            messages: room.messages
          })
        }
        return callback({
          status: 'error',
          message: `Room ${roomId} does not exist`
        })
      }).catch((err: Error) => {
        logWithDate(`Unable to retrieve messages for room ${roomId}: ${err}`, true)
        return callback({
          status: 'error',
          message: `Unable to retrieve room messages`
        })
      })
    })

    // TODO: emit new messages to all users
    // TODO: get username from auth instead
    socket.on('rooms:messages:send', (roomId, userName, messages, callback) => {
      logWithDate(`@POST /rooms/${roomId}/messages`)
      let result: IRoom | null = null
      if (roomId != null && userName != null && messages != null) {
        logWithDate(`Sending message from user ${userName} to room ${roomId}`)
        // create message, then add it to a room
        const messageWrites = messages.map((message: IMessageData) => {
          return new Promise<void>((resolve, reject) => {
            // insert each message into DB collection
            dbhelper.sendMessageToRoom(message, userName, roomId)
              .then((room: IRoom | null) => {
                result = room
                resolve()
              })
              .catch((err: Error) => {
                logWithDate(`Error writing message from user ${userName} to room ${roomId}: ${err}`, true)
                reject()
              })
          })
        })
        Promise.all(messageWrites).then(() => {
          logWithDate(`Wrote all messages successfully.`)
          if (result != null) {
            return callback({
              status: 'ok',
              messages: result.messages
            })
          }
          else {
            logWithDate(`Error writing messages to room.`)
            return callback({
              status: 'error',
              message: `Failed to write messages to room.`
            })
          }
        }).catch((err: Error) => {
          logWithDate(`Failed to send messages from user ${userName} to room ${roomId}: ${err}`, true)
          return callback({
            status: 'error',
            message: `Failed to send message to room`
          })
        })
      } else {
        logWithDate(`Missing roomId in URL params or userName, messages objects in request body`)
        return callback({
          status: 'error'
        })
      }
    })

    // TODO: emit new messages to all users
    socket.on('rooms:messages:delete', (messageId, roomId, userName, callback) => {
      // TODO: check if user exists in room and is message author before deleting
      logWithDate(`@DELETE /messages`)
      if (messageId != null) {
        logWithDate(`Deleting message with id ${messageId} from room ${roomId}`)
        dbhelper.deleteMessageById(messageId).then(() => {
            dbhelper.getRoomMessages(roomId).then((room: IRoom | null) => {
              logWithDate(`Message deleted successfully`)
              const messages: IMessage[] = (room != null) ? room.messages : []
              return callback({
                status: 'ok',
                messages: messages
              })
            }).catch((err: Error) => {
              logWithDate(`Failed to retrieve messages for room ${roomId}: ${err}`, true)
              return callback({
                status: 'error',
                message: `Failed to get room messages.`
              })
            })
          }).catch((err: Error) => {
            logWithDate(`Failed to delete message with id ${messageId}: ${err}`, true)
            return callback({
              status: 'error',
              message: `Failed to delete message`
            })
          })
      } else {
        logWithDate(`Missing messageId in request body`)
        return callback({
          status: 'error'
        })
      }
    })

    socket.on('disconnect', () => {
      console.log('user disconnected.')
      // TODO - remove user from room but don't delete room
    })
  })




export default app
