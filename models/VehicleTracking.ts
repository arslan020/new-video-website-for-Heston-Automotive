import mongoose, { Document, Model } from 'mongoose';

export interface IStageHistoryEntry {
  stage: number;
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId;
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
