import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  username: string;
  name?: string;
  password: string;
  email: string;
  phoneNumber: string;
  role: 'admin' | 'staff';
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  isTwoFactorEnabled: boolean;
  twoFactorCode?: string;
  twoFactorCodeExpire?: Date;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
  getResetPasswordToken(): string;
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    name: { type: String, required: false },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isTwoFactorEnabled: { type: Boolean, default: false },
    twoFactorCode: String,
    twoFactorCodeExpire: Date,
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword: string) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);
  return resetToken;
};

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
export default User;
