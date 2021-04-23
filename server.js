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
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
// const multer = require('multer')
// const fs = require('fs')
// import mongoose schema and assign model names
const models = require('./models/schema.js') 
const User = models.user
const Message = models.message
const Room = models.room
// const Avatar = models.avatar

const app = express()

// Express server
const staticFileMiddleware = express.static(path.resolve(__dirname) + '/dist')
console.log(path.resolve(__dirname) + '/dist')
app.use(staticFileMiddleware)
app.use(bodyParser.urlencoded({ extended: false }))
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

// connect to mongodb and ensure it works before starting server
mongoose.set('useFindAndModify', false)
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhosts:27017/test', { useNewUrlParser: true, useUnifiedTopology: true })
// if connection is successful, create DB and initialize server
var db = mongoose.connection
console.log('Database connection ready.')
// bind connection on error event
db.on('error', console.error.bind(console,  'MongoDB connection error:'))

// start server
var port = process.env.PORT || 5000
app.listen(port)
console.log('server started on port: ' + port)

//// ROUTES /////

// TODO - refactor HTTP verbs
// TODO - add logging to all endpoints
// TODO - refactor all DB updates to separate functions
// TODO - add unit tests with supertest
// TODO - create API endpoint documentation from comments (automated?)
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
app.get('/rooms/info', function(req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  if (process.env.NODE_ENV !== 'production') {
    Room.find({}).then((rooms) => {
      res.status(200).send({ rooms: rooms })
    })
  }
  else {
    res.status(200).send('Nice try :)')
  }
})

/**
 * Get specific room info, including messages
 */
app.get('/rooms/:roomCode/info', function(req, res) {
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Content-Type', 'application/json')
  if (req.params.roomCode != null) {
    console.log(`Finding room: ${req.params.roomCode}`)
    Room.findOne({
      entryCode: req.params.roomCode
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
    }).then(function (room) {
        res.status(200).send({ room: room })
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
 app.post('/rooms/create', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  if (req.body.user != null) {
    // create a room with unique 4 char guid and add user to it
    const roomCode = nanoid.nanoid(4)
    Room.create({
      entryCode: roomCode,
      participants: [req.body.user],
      messages: []
    }).then(function(room) {
      res.status(200).send({ room: room })
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
app.post('/rooms/:roomCode/join', function(req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // join an existing room using a code
  if (req.params.roomCode != null && req.body.user != null) {
    // find room by roomCode, add user to it, and populate the array of users in room
    Room.findOneAndUpdate(
      { 
        entryCode: req.params.roomCode
      },
      {
        $push: {
          participants: new ObjectId(req.body.user)
        }
      },
      {
        new: true // get result after performing the update
      }
    ).populate({
        path: 'participants',
        select: '-email -password'
    }).populate({
        path: 'messages',
        select: '-room',
        populate: {
          path: 'author',
          select: '-email-password'
        }
    }).then((room) => {
      // return data for room
      res.status(200).send({ room: room })
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
  if (req.params.roomCode != null && req.body.user != null) {
    // find room by code and leave it
    Room.findOneAndUpdate(
      {
        entryCode: req.params.roomCode
      },
      {
        // remove user from room by id
        $pull: { participants: new ObjectId(req.body.user) }
      },
      {
        new: true // get result after performing the update.
      }).then((room) => {
        // if room is empty, delete room
        if (room.participants.length === 0) {
          Room.deleteOne({ _id: room._id }, function (err) {
            if (err) {
              res.status(400).send(`Failed to remove room ${err.message}`)
            }
          })
        }
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
app.post('/rooms/:roomId/messages', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // get messages for a room by id
  Room.findById(req.params.roomId)
  .populate({
    path: 'messages',
    select: '-room',
    populate: {
      path: 'author',
      select: '-email -password'
    }
  })
  .then((room) => {
    if (room.participants.includes(req.body.user)) {
      res.status(200).send(room.messages)
    }
    else {
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
app.post('/rooms/:roomId/messages/send', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // create message, then add it to a room
  req.body.messages.forEach( function(message) {
    // insert each message into DB collection
    Message.create({
      author: new ObjectId(req.body.user),
      room: new ObjectId(req.params.roomId),
      title: message.title,
      date: Date.now(),
      imageData: message.imageData,
      background: message.background
    })
    .then((message) => {
      Room.findByIdAndUpdate(req.params.roomId,
        {
          $push: {
            messages: new ObjectId(message._id)
          }
        },
        {
          new: true
        }
      ).populate({
        path: 'messages',
        select: '-room',
        populate: {
          path: 'author',
          select: '-email -password'
        }
      }).then((room) => {
        res.status(200).send(room.messages)
      }).catch((err) => {
        res.status(400).send(`Failed to send message to room: ${err.message}`)
      })
    }).catch((err) => {
      res.status(400).send(`Failed to create message: ${err.message}`)
    })
  })
})

/**
 * Delete a message by message id
 */
 app.delete('/messages/delete', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'DELETE')
  res.header('Content-Type', 'application/json')
  Message.findByIdAndDelete(req.body.message)
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
  User.findById(req.params.userId, {
    name: 1,
    email: 1
  })
  .then((doc) => {
      return res.status(200).json({ user: doc })
  }).catch((err) => {
    res.status(400).send(`Failed to get user: ${err.message}`)
  })
})

/**
 * Create a new user account
 * Takes in an object containing name, email, and password fields
 */
// TODO: check for duplicate user names and emails before allowing signup
app.post('/account/register', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  // create new user
  bcrypt.hash(req.body.password, 8).then((hashedPassword) => {
    User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      // avatar: req.body.avatar, 
    }).then(() => {
      // log in user with token
      User.findOne({ email: req.body.email })
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
  }).catch((err) => {
    console.log(err)
    return res.status(500).send('Server error.')
  })
  
})

/**
 * Log user in and provide with auth token
 * Takes in object with email and password
 */
app.post('/account/login', function (req, res) {
  res.header('Access-Control-Allow-Methods', 'POST')
  res.header('Content-Type', 'application/json')
  User.findOne({
    email: req.body.email
  }).then((doc) => {
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
app.put('/account/update', function (req, res) {
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
      // TODO - can refactor to be a function taking in "updated" object
      User.findByIdAndUpdate(
        req.body.id,
        { 
          $set: updated
        }
      ).then(() => {
        res.sendStatus(200)
      }).catch((err) => {
        res.status(400).send(`Failed to update account: ${err.message}`)
      })
    }).catch((err) => {
      res.status(400).send(`Failed to update account: ${err.message}`)
    })

  }
  else {
    // get user belonging to that context GUID and update their properties
    // TODO - can refactor to be a function taking in "updated" object
    User.findByIdAndUpdate(
      req.body.id,
      { 
        $set: updated
      }
    ).then(() => {
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