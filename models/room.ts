import mongoose, { Schema, Document } from 'mongoose'
import { IMessage } from './message'

export interface IRoom extends Document {
  entryCode: string,
  participants: Array<string>,
  messages: Array<IMessage['_id']>
}

const RoomSchema: Schema = new Schema({
  entryCode: {
    type: String,
    required: true
  },
  participants: [{
    type: String,
    required: true
  }],
  messages: [{
    type: Schema.Types.ObjectId,
    ref: 'message'
  }]
})

export default mongoose.model<IRoom>('room', RoomSchema)
