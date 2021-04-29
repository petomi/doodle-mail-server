import mongoose, { Schema, Document } from 'mongoose'
import { IRoom } from './room'
import { IUser } from './user'

export interface IMessage extends Document {
  author: IUser['_id'],
  room: IRoom['_id'],
  title: string,
  date: string,
  imageData: string,
  background: string
}

const MessageSchema: Schema = new Schema({
  author: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: 'room',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  imageData: {
    type: String,
    required: true
  },
  background: {
    type: String,
    required: true
  }
})

export default mongoose.model<IMessage>('message', MessageSchema)
