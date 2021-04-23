const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const ObjectId = mongoose.Types.ObjectId
const models = require('../models/schema.js') 
const User = models.user
const Message = models.message
const Room = models.room

const mongotest = new MongoMemoryServer()

// see: https://dev.to/paulasantamaria/testing-node-js-mongoose-with-an-in-memory-database-32np

/**
 * Connect to in-memory db
 */
module.exports.connect = async () => {
    const uri = await mongotest.getUri()

    const mongooseOpts = {
        useNewurlParser: true,
        autoReconnect: true,
        reconnectTries: Number.MAX_VALUE,
        reconnectInterval: 1000
    }

    await mongoose.connect(uri, mongooseOpts)
}

/**
 * Drop database, close connection, and stop in memory db
 */
module.exports.closeDatabase = async() => {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    await mongotest.stop()
}

/**
 * Remove all the data for all db connections
 */
module.exports.clearDatabase = async () => {
    const collections = mongoose.connection.collections
    
    for (const key in collections) {
        const collection = collections[key]
        await collection.deleteMany()
    }
}

/**
 * Seed initial data for testing with
 */
module.exports.seedData = async () => {
    console.log('Seeding test data...')
    User.create([
        {
            name: 'Jim Test',
            email: 'test@test.com',
            password: '$2b$08$KLu9La4ucbj.aKDBnS/9d.TnsrrEp.yyQHcuJZFkNrCFt0MQEAgK2'
        },
        {
            name: 'Bob Test',
            email: 'test2@test.com',
            password: '$2b$08$ZCNcsq1agfLQvV3Von21nu9po452CsgFDD1ccQLBBTGhIAziQXVJO'
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
            Message.create([
                {
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
                    Room.findByIdAndUpdate(room._id,
                        {
                            $push: {
                                messages: new ObjectId(message._id)
                            }
                        }
                    )
                })
            })
        })
    }).then(() => {
        // console.log('Finished seeding mock db!')
    }).catch((err) => {
        console.log(`Error seeding mock db: ${err}`)
    })
}
