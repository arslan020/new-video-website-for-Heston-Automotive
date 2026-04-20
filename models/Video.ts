import mongoose, { Document, Model } from 'mongoose';

export interface IVideoView {
  shareId?: mongoose.Types.ObjectId;
  viewedAt: Date;
  viewerName?: string;
  viewerEmail?: string;
  viewerMobile?: string;
}

export interface ISubPart {
  _id: mongoose.Types.ObjectId;
  name: string;
  cloudflareVideoId: string;
  thumbnailUrl?: string;
  createdAt: Date;
}

export interface IVideo extends Omit<Document, 'model'> {
  uploadedBy: mongoose.Types.ObjectId;
  videoUrl: string;
  videoSource: 'cloudinary' | 'youtube' | 'cloudflare';
  youtubeVideoId?: string;
  cloudflareVideoId?: string;
  publicId?: string;
  originalName?: string;
  title: string;
  viewCount: number;
  registration?: string;
  make?: string;
  model?: string;
  vehicleDetails?: Record<string, unknown>;
  reserveCarLink?: string;
  mileage?: number;
  linkExpiresAt?: Date;
  thumbnailUrl?: string;
  deletedAt?: Date;
  views: IVideoView[];
  subParts: ISubPart[];
  createdAt: Date;
  updatedAt: Date;
}

const videoSchema = new mongoose.Schema<IVideo>(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    videoUrl: { type: String, required: true },
    videoSource: { type: String, enum: ['cloudinary', 'youtube', 'cloudflare'], default: 'cloudinary' },
    youtubeVideoId: String,
    cloudflareVideoId: String,
    publicId: String,
    originalName: String,
    title: { type: String, default: 'Untitled Video' },
    viewCount: { type: Number, default: 0 },
    registration: { type: String, uppercase: true, trim: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    vehicleDetails: { type: mongoose.Schema.Types.Mixed },
    reserveCarLink: { type: String, trim: true },
    mileage: Number,
    linkExpiresAt: Date,
    thumbnailUrl: { type: String, trim: true },
    deletedAt: { type: Date, default: null },
    subParts: [
      {
        name: { type: String, required: true, trim: true },
        cloudflareVideoId: { type: String, required: true },
        thumbnailUrl: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    views: [
      {
        shareId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuditLog' },
        viewedAt: { type: Date, default: Date.now },
        viewerName: String,
        viewerEmail: String,
        viewerMobile: String,
      },
    ],
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production' && mongoose.models.Video) {
  delete (mongoose.models as any).Video;
}
const Video: Model<IVideo> = (mongoose.models.Video as Model<IVideo>) || mongoose.model<IVideo>('Video', videoSchema);
export default Video;
