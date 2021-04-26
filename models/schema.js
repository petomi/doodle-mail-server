const mongoose = require('mongoose')

const Schema = mongoose.Schema

const avatarSchema = new Schema({
  // TODO - fill this with uploaded photo stuff instead
  location: String
})
const Avatar = mongoose.model('avatar', avatarSchema)

const userSchema = new Schema({
  name: String,
  email: String,
  password: String,
  // avatar: { type: Schema.Types.ObjectId, ref: 'avatar' } // TODO - if empty, just use initials.
})
const User = mongoose.model('user', userSchema)

const messageSchema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'user'
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: 'room'
  },
  title: String,
  date: String,
  imageData: String,
  background: String
})
const Message = mongoose.model('message', messageSchema)

const roomSchema = new Schema({
  entryCode: String,
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'user'
  }],
  messages: [{
    type: Schema.Types.ObjectId,
    ref: 'message'
  }]
})
const Room = mongoose.model('room', roomSchema)

// export the models so node can see them
module.exports = {
  avatar: Avatar,
  message: Message,
  user: User,
  room: Room
}
