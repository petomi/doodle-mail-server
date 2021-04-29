import mongoose, { Schema, Document } from 'mongoose'
import { IMessage } from './message'
import { IUser } from './user'

export interface IRoom extends Document {
  entryCode: string,
  participants: Array<IUser['_id']>,
  messages: Array<IMessage['_id']>
}

const RoomSchema: Schema = new Schema({
  entryCode: {
    type: String,
    required: true
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'user'
  }],
  messages: [{
    type: Schema.Types.ObjectId,
    ref: 'message'
  }]
})

export default mongoose.model<IRoom>('room', RoomSchema)
