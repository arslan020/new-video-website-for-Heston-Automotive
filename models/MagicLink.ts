import mongoose, { Document, Model } from 'mongoose';

export interface IMagicLink extends Document {
  token: string;
  video: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const magicLinkSchema = new mongoose.Schema<IMagicLink>(
  {
    token: { type: String, required: true, unique: true, index: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

magicLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const MagicLink: Model<IMagicLink> = mongoose.models.MagicLink || mongoose.model<IMagicLink>('MagicLink', magicLinkSchema);
export default MagicLink;
