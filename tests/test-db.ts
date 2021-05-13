/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import Message, { IMessage } from "../models/message";
import Room, { IRoom } from "../models/room";
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

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
    await collections[key].deleteMany({});
  }
};

const seed = () => {
  return new Promise<void>(function (resolve) {
    Room.create({
      entryCode: 'ABCD',
      participants: [{userName:'pleb', id: '45'}, {userName:'bob', id: '6'}],
      messages: []
    }).then((room: IRoom) => {
      Message.create([{
        author: {userName: 'pleb', id: '45'},
        room: new ObjectId(room._id),
        title: 'Test Message 1',
        date: new Date(),
        imageData: 'testimagedata',
        background: 'white'
      },
      {
        author: {userName:'bob', id: '6'},
        room: new ObjectId(room._id),
        title: 'Test Message 2',
        date: new Date(),
        imageData: 'testimagedata',
        background: 'white'
      }
      ]).then((messages: Array<IMessage>) => {
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
}

/***
 * Helper Methods
 */
const getRoom = async () => {
  const room = await Room.findOne({})
  if (room != null) {
    return room
  } else {
    throw new Error(`No rooms in test db.`)
  }
}

const getMessage = async () => {
  const message = await Message.findOne({})
  if (message != null) {
    return message
  } else {
    throw new Error(`No messages in test db.`)
  }
}

export default {
  connect,
  close,
  clear,
  seed,
  getMessage,
  getRoom
}
