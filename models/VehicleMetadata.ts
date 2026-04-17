import mongoose, { Document, Model } from 'mongoose';

export interface IVehicleMetadata extends Document {
  registration: string;
  reserveLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleMetadataSchema = new mongoose.Schema<IVehicleMetadata>(
  {
    registration: { type: String, required: true, unique: true, uppercase: true, trim: true },
    reserveLink: { type: String, trim: true },
  },
  { timestamps: true }
);

const VehicleMetadata: Model<IVehicleMetadata> =
  mongoose.models.VehicleMetadata || mongoose.model<IVehicleMetadata>('VehicleMetadata', vehicleMetadataSchema);
export default VehicleMetadata;
