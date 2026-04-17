import mongoose, { Document, Model } from 'mongoose';

export interface IStock extends Document {
  advertiserId: string;
  stockData: unknown[];
  lastSyncTime: Date;
  totalVehicles: number;
  syncStatus: 'success' | 'failed' | 'in_progress';
  createdAt: Date;
  updatedAt: Date;
}

const stockSchema = new mongoose.Schema<IStock>(
  {
    advertiserId: { type: String, required: true },
    stockData: { type: Array, default: [] },
    lastSyncTime: { type: Date, default: Date.now },
    totalVehicles: { type: Number, default: 0 },
    syncStatus: { type: String, enum: ['success', 'failed', 'in_progress'], default: 'success' },
  },
  { timestamps: true }
);

stockSchema.index({ advertiserId: 1 }, { unique: true });

const Stock: Model<IStock> = mongoose.models.Stock || mongoose.model<IStock>('Stock', stockSchema);
export default Stock;
