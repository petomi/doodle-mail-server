import mongoose, { Schema, Document } from 'mongoose'
import { IRoom } from './room'
import IUser from './user'

export interface IMessage extends Document {
  author: IUser,
  room: IRoom['_id'],
  title: string,
  date: Date,
  imageData: string,
  background: string
}

const MessageSchema: Schema = new Schema({
  author: {
    type: Object,
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
    type: Date,
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
