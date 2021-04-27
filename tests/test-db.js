const mongoose = require('mongoose');
const {
  MongoMemoryServer
} = require('mongodb-memory-server');
const {
  User,
  Message,
  Room
} = require('../models/schema')
const ObjectId = mongoose.Types.ObjectId

// see: https://dev.to/ryuuto829/setup-in-memory-database-for-testing-node-js-and-mongoose-1kop

const mongoServer = new MongoMemoryServer();

const opts = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

// Provide connection to a new in-memory database server.
const connect = async () => {
  // NOTE: before establishing a new connection close previous
  await mongoose.disconnect();

  const mongoUri = await mongoServer.getUri();
  mongoose.set('useFindAndModify', false)
  await mongoose.connect(mongoUri, opts, err => {
    if (err) {
      console.error(err);
    }
  });
};

// Remove and close the database and server.
const close = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

// Remove all data from collections
const clear = async () => {
  const collections = mongoose.connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany();
  }
};

const seed = () => {
  return new Promise(function (resolve) {
    User.create([{
        name: 'Jim Test',
        email: 'test@test.com',
        password: '$2b$08$KLu9La4ucbj.aKDBnS/9d.TnsrrEp.yyQHcuJZFkNrCFt0MQEAgK2'
      },
      {
        name: 'Bob Test',
        email: 'test2@test.com',
        password: '$2b$08$ZCNcsq1agfLQvV3Von21nu9po452CsgFDD1ccQLBBTGhIAziQXVJO'
      },
      {
        name: 'Tracy Test',
        email: 'test3@test.com',
        password: '$2b$08$KLu9La4ucbj.aKDBnS/9d.TnsrrEp.yyQHcuJZFkNrCFt0MQEAgK2'
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
            })
          })
        })
      })
    })
  })
}

module.exports = {
  connect,
  close,
  clear,
  seed
};
