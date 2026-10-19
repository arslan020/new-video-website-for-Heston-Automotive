import mongoose, { Document, Model } from 'mongoose';

export interface ISaleWindow extends Document {
  invoiceNumber: string;
  vin: string;
  invoiceDate: Date;
  financingDate: Date;
  vehicleType: 'Stock' | 'Demo';
  initialAmount: number;
  outstandingAmount: number;
  soldAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const saleWindowSchema = new mongoose.Schema<ISaleWindow>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    vin: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, required: true },
    financingDate: { type: Date, required: true },
    vehicleType: { type: String, enum: ['Stock', 'Demo'], required: true },
    initialAmount: { type: Number, required: true },
    outstandingAmount: { type: Number, required: true },
    soldAt: { type: Date, default: null },
  },
  { timestamps: true }
);

if (mongoose.models.SaleWindow) {
  mongoose.deleteModel('SaleWindow');
}

const SaleWindow: Model<ISaleWindow> = mongoose.model<ISaleWindow>('SaleWindow', saleWindowSchema);

export default SaleWindow;
