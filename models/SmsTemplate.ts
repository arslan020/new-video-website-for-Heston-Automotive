import mongoose, { Document, Model } from 'mongoose';

export interface ISmsTemplateCustomer {
  motordeskId: number;
  name: string;
  mobile: string;
}

export interface ISmsTemplate extends Document {
  name: string;
  body: string;
  customers: ISmsTemplateCustomer[];
  createdAt: Date;
  updatedAt: Date;
}

const smsTemplateSchema = new mongoose.Schema<ISmsTemplate>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    body: { type: String, default: '', trim: true, maxlength: 480 },
    customers: {
      type: [{
        motordeskId: { type: Number, required: true },
        name: { type: String, required: true, trim: true },
        mobile: { type: String, required: true, trim: true },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

if (mongoose.models.SmsTemplate) mongoose.deleteModel('SmsTemplate');

const SmsTemplate: Model<ISmsTemplate> = mongoose.model<ISmsTemplate>('SmsTemplate', smsTemplateSchema);

export default SmsTemplate;
