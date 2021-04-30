import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  name: string,
  email: string,
  password: string
}

const UserSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  }
  // avatar: { type: Schema.Types.ObjectId, ref: 'avatar' } // TODO - if empty, just use initials.
})

export default mongoose.model<IUser>('user', UserSchema)
