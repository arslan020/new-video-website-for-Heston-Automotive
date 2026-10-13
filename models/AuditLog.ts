import mongoose, { Document, Model } from 'mongoose';

export type AuditAction =
  | 'UPLOAD_VIDEO'
  | 'DELETE_VIDEO'
  | 'UPDATE_VIDEO'
  | 'SHARE_VIDEO_LINK'
  | 'SEND_VIDEO_LINK'
  | 'SUSPEND_LINK'
  | 'ENABLE_LINK'
  | 'UPDATE_VEHICLE_STAGE'
  | 'SEND_TRACKING_LINK'
  | 'ADD_VEHICLE_REMARK'
  | 'OTHER';

export interface IAuditLog extends Document {
  action: AuditAction;
  user: mongoose.Types.ObjectId;
  details: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  suspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      enum: ['UPLOAD_VIDEO', 'DELETE_VIDEO', 'UPDATE_VIDEO', 'SHARE_VIDEO_LINK', 'SEND_VIDEO_LINK', 'SUSPEND_LINK', 'ENABLE_LINK', 'UPDATE_VEHICLE_STAGE', 'SEND_TRACKING_LINK', 'ADD_VEHICLE_REMARK', 'OTHER'],
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    details: { type: String, required: true },
    targetId: { type: String, required: false },
    metadata: { type: Object, required: false },
    ipAddress: { type: String, required: false },
    suspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production' && mongoose.models.AuditLog) {
  delete (mongoose.models as any).AuditLog;
}
const AuditLog: Model<IAuditLog> = (mongoose.models.AuditLog as Model<IAuditLog>) || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
