import mongoose, { Document, Model } from 'mongoose';

export interface IBooking extends Omit<Document, 'model'> {
  videoId: mongoose.Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  visitDate: Date;
  visitTime: string;
  registration?: string;
  make?: string;
  model?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new mongoose.Schema<IBooking>(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    customerPhone: { type: String, required: true, trim: true },
    visitDate: { type: Date, required: true },
    visitTime: { type: String, required: true },
    registration: { type: String, uppercase: true, trim: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);
export default Booking;
