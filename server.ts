import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
import bodyParser from 'body-parser'
import cors from 'cors'
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

// create server and websocket
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: allowedOrigins
  }
})

// check for existing userName on connection
io.use((socket, next) => {
  // set socket user data from authentication layer
  const userName = socket.handshake.auth.userName
  if (!userName) {
    return next(new Error('invalid username'))
  }
  socket.data.user = {
    userName: userName,
    id: socket.id
  }
  next()
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
  // friendly welcome :)
  console.log('User joined.')
  socket.emit('welcome', 'Welcome to doodle mail! :)')

  // socket event listeners
  socket.on('rooms:info', (roomCode) => getRoomInfo(roomCode))
  socket.on('rooms:create', async () => await createRoom())
  socket.on('rooms:join', (roomCode) => joinRoom(roomCode))
  socket.on('rooms:leave', (roomCode) => leaveRoom(roomCode))
  socket.on('rooms:messages', (roomId) => getRoomMessages(roomId))
  socket.on('rooms:messages:send', (roomId, messages) => sendMessageToRoom(roomId, messages) )
  socket.on('rooms:messages:delete', (messageId, roomId) => deleteMessage(messageId, roomId))

  // TODO: may be able to factor out joining + leaving rooms as sockets make it irrelevant
  // TODO: refactor these methods further into logic modules and add server.spec.ts with unit tests for them

  /**
   * Returns room info for specific room
   * @param {string} roomCode
   */
  function getRoomInfo (roomCode: string) {
    logWithDate(`@GET /rooms/${roomCode}/info`)
    if (roomCode != null) {
      logWithDate(`Finding room: ${roomCode}`)
      dbhelper.getRoomInfo(roomCode).then((room: IRoom | null) => {
        socket.emit('room:info', {
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
  }

  /**
   * Creates a new room and adds user to it.
   */
  async function createRoom () {
    logWithDate(`@POST /rooms`)
    const userName = socket.data.user.userName
    if (userName != null) {
      // generate room code
      logWithDate(`Generating unique 4 digit room code`)
      const roomCode: string = await dbhelper.generateUniqueRoomCode()
      logWithDate(`Creating room for user: ${userName} with code: ${roomCode}`)
      // create room in db
      dbhelper.createRoom(socket.data.user, roomCode).then((room: IRoom) => {
        // join that room
        socket.join(roomCode)
        // send back the new room data
        socket.emit('room:create', {
          room: room
        })
        io.to(roomCode).emit('user:joined', {
          message: `User ${userName} joined the room.`
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
  }

  /**
   * Adds a user to an existing room.
   * @param {string} roomCode
   */
  function joinRoom (roomCode: string) {
    logWithDate(`@POST /rooms/${roomCode}/join`)
    const userName = socket.data.user.userName
    // join an existing room using a code
    if (roomCode != null && userName != null) {
      logWithDate(`User ${userName} attempting to join room with code ${roomCode}`)
      dbhelper.getRoomInfo(roomCode).then((room) => {
        if (room == null) {
          logWithDate(`Failed to add user ${userName} to room ${roomCode}: room is null`)
          socket.emit('error', {
            message: `Room does not exist.`
          })
          return
        }
        // check name against existing room occupants
        if ((room?.participants.filter((x) => x.userName === userName).length ?? 0) > 0) {
          logWithDate(`User ${userName} already exists in room ${roomCode}`)
          socket.emit('error', {
            message: `Someone with same name is already in room.`
          })
        }
        // find room by roomCode, add user to it, and populate the array of users in room
        dbhelper.joinRoom(socket.data.user, roomCode).then((room: IRoom | null) => {
          logWithDate(`Joined room successfully.`)
          // listen for broadcasts to that specific roomCode
          socket.join(roomCode)
          // return data for room
          socket.emit('room:join', {
            room: room
          })
          io.to(roomCode).emit('user:joined', {
            message: `User ${userName} joined the room.`
          })
        }).catch((err: Error) => {
          logWithDate(`Failed to add user ${userName} to room ${roomCode}: ${err}`, true)
          socket.emit('error', {
            message: `Failed to add user to room.`
          })
        })
      }).catch((err: Error) => {
        logWithDate(`Failed to add user ${userName} to room ${roomCode}: ${err}`, true)
        socket.emit('error', {
          message: `Failed to add user to room.`
        })
      })
    } else {
      logWithDate(`Missing roomCode in URL params or userName in request body`)
      // throw error if data is incomplete.
      socket.emit('error', {
        message: `Missing roomCode in URL params or userName in request body`
      })
    }
  }

  /**
   * Remove a user from a specific room.
   * @param {string} roomCode
   */
  function leaveRoom (roomCode: string) {
    logWithDate(`@POST /rooms/${roomCode}/leave`)
    const userName = socket.data.user.userName
    // join an existing room using a code
    if (roomCode != null && userName != null) {
      logWithDate(`User ${userName} attempting to leave room with code ${roomCode}`)
      // find room by code and leave it
      dbhelper.leaveRoom(socket.data.user, roomCode).then(() => {
        logWithDate(`User ${userName} left room ${roomCode} successfully.`)
        socket.leave(roomCode)
        socket.data.room.code = null
        socket.emit('room:leave', {
          message: 'ok'
        })
        io.to(roomCode).emit('user:left', {
          message: `User ${userName} left the room.`
        })
      }).catch((err: Error) => {
        logWithDate(`Failed to remove user ${userName} from room ${roomCode}: ${err}`, true)
        socket.emit('error', {
          message: `Failed to remove user from room`
        })
      })
    } else {
      logWithDate(`Missing roomCode in URL parameters or userName in request body`)
      // throw error if data is incomplete
      socket.emit('error', {
        message: `Missing roomCode in URL parameters or userName in request body`
      })
    }
  }

  /**
   * Get messages from a certain room.
   * @param {string} roomId
   */
  function getRoomMessages (roomId: string) {
    logWithDate(`@GET /rooms/${roomId}/messages`)
    // get messages for a room by id
    dbhelper.getRoomMessages(roomId).then((room: IRoom | null) => {
      if (room != null) {
        logWithDate(`Getting messages for room ${roomId}`)
        socket.emit('messages', {
          messages: room.messages
        })
      }
      socket.emit('error', {
        message: `Room ${roomId} does not exist`
      })
    }).catch((err: Error) => {
      logWithDate(`Unable to retrieve messages for room ${roomId}: ${err}`, true)
      socket.emit('error', {
        message: `Unable to retrieve room messages`
      })
    })
  }

  /**
   * Send a message to the room
   * @param {string} roomId
   * @param {Array<IMessage>} messages
   */
  function sendMessageToRoom (roomId:string, messages:Array<IMessage>) {
    logWithDate(`@POST /rooms/${roomId}/messages`)
    const userName = socket.data.user.userName
    let result: IRoom | null = null
    if (roomId != null && userName != null && messages != null) {
      logWithDate(`Sending message from user ${userName} to room ${roomId}`)
      // create message, then add it to a room
      const messageWrites = messages.map((message: IMessageData) => {
        return new Promise<void>((resolve, reject) => {
          // insert each message into DB collection
          dbhelper.sendMessageToRoom(message, socket.data.user, roomId)
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
          io.to(result.entryCode).emit('messages', {
            messages: result.messages
          })
        }
        else {
          logWithDate(`Error writing messages to room.`)
          socket.emit('error', {
            status: 'error',
            message: `Failed to write messages to room.`
          })
        }
      }).catch((err: Error) => {
        logWithDate(`Failed to send messages from user ${userName} to room ${roomId}: ${err}`, true)
        socket.emit('error', {
          message: `Failed to send message to room`
        })
      })
    } else {
      logWithDate(`Missing roomId in URL params or userName, messages objects in request body`)
      socket.emit('error', {
        message: `Missing roomId in URL params or userName, messages objects in request body`
      })
    }
  }

  /**
   * Delete a specific message by message id.
   * @param {string} messageId
   * @param {string} roomId
   */
  function deleteMessage (messageId: string, roomId: string) {
    logWithDate(`@DELETE /messages`)
    const userName = socket.data.user.userName
    if (messageId != null) {
      logWithDate(`Deleting message with id ${messageId} from room ${roomId}`)
      dbhelper.getMessageById(messageId).then((message) => {
        if (message?.author?.userName !== userName) {
          socket.emit('error', {
            message: 'Only the author is allowed to delete this message.'
          })
          return
        }
        dbhelper.deleteMessageById(messageId).then(() => {
          dbhelper.getRoomMessages(roomId).then((room: IRoom | null) => {
            if (room != null) {
              logWithDate(`Message deleted successfully`)
              const messages: IMessage[] = (room != null) ? room.messages : []
              io.to(room.entryCode).emit('messages', {
                messages: messages
              })
            } else {
              logWithDate(`Failed to delete message. Room does not exist.`)
              socket.emit('error', {
                message: 'Room does not exist.'
              })
            }
          }).catch((err: Error) => {
            logWithDate(`Failed to retrieve messages for room ${roomId}: ${err}`, true)
            socket.emit('error', {
              message: `Failed to get room messages.`
            })
          })
        }).catch((err: Error) => {
          logWithDate(`Failed to delete message with id ${messageId}: ${err}`, true)
          socket.emit('error', {
            message: `Failed to delete message`
          })
        })
      })
    } else {
      logWithDate(`Missing messageId in request body`)
      socket.emit('error', {
        message: `Missing messageId in request body`
      })
    }
  }

  socket.on('disconnect', () => {
    console.log(`User ${socket.data.user.userName} disconnected.`)
  })
})



export default app
