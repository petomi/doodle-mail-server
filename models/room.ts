import mongoose, { Schema, Document } from 'mongoose'
import { IMessage } from './message'
import IUser from './user'

export interface IRoom extends Document {
  entryCode: string,
  participants: Array<IUser>,
  messages: Array<IMessage['_id']>
}

const RoomSchema: Schema = new Schema({
  entryCode: {
    type: String,
    required: true
  },
  participants: [{
    type: Object,
    required: true
  }],
  messages: [{
    type: Schema.Types.ObjectId,
    ref: 'message'
  }]
})

export default mongoose.model<IRoom>('room', RoomSchema)
