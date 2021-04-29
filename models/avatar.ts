import mongoose, { Schema, Document } from 'mongoose'

export interface IAvatar extends Document {
    location: string
}

const AvatarSchema: Schema = new Schema({
  // TODO - fill this with uploaded photo stuff instead
  location: {
      type: String,
      required: true
  }
})

export default mongoose.model<IAvatar>('avatar', AvatarSchema)
