import mongoose, { Document, Model } from 'mongoose';

export interface IStageHistoryEntry {
  stage: number;
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
}

export interface IStageRemark {
  stage: number;
  text: string;
  createdAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  customerReply?: string;
  repliedAt?: Date;
}

export interface IVehicleTracking extends Omit<Document, 'model'> {
  stockId: string;
  vin?: string;
  registration?: string;
  make?: string;
  model?: string;
  derivative?: string;
  colour?: string;
  image?: string;
  currentStage: number;
  stageHistory: IStageHistoryEntry[];
  remarks: IStageRemark[];
  // Pre-orders: a customer order placed for a model that isn't in physical stock yet.
  // Unlike real stock items (one record per VIN), a model can have several pre-order
  // records at once, one per customer.
  isPreOrder?: boolean;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  lastViewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stageHistorySchema = new mongoose.Schema<IStageHistoryEntry>(
  {
    stage: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const stageRemarkSchema = new mongoose.Schema<IStageRemark>(
  {
    stage: { type: Number, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerReply: String,
    repliedAt: Date,
  },
  { _id: false }
);

const vehicleTrackingSchema = new mongoose.Schema<IVehicleTracking>(
  {
    stockId: { type: String, required: true, unique: true },
    vin: String,
    registration: String,
    make: String,
    model: String,
    derivative: String,
    colour: String,
    image: String,
    currentStage: { type: Number, default: 0 },
    stageHistory: { type: [stageHistorySchema], default: [] },
    remarks: { type: [stageRemarkSchema], default: [] },
    isPreOrder: { type: Boolean, default: false },
    customerName: String,
    customerEmail: String,
    customerMobile: String,
    lastViewedAt: Date,
  },
  { timestamps: true }
);

if (process.env.NODE_ENV !== 'production' && mongoose.models.VehicleTracking) {
  delete (mongoose.models as any).VehicleTracking;
}
const VehicleTracking: Model<IVehicleTracking> =
  (mongoose.models.VehicleTracking as Model<IVehicleTracking>) ||
  mongoose.model<IVehicleTracking>('VehicleTracking', vehicleTrackingSchema);

export default VehicleTracking;
