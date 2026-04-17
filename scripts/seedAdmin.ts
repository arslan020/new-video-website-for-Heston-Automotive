import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import User from '../models/User';

const importData = async () => {
  try {
    await connectDB();

    await User.deleteMany({});

    const adminUser = new User({
      username: 'admin',
      password: 'password123',
      role: 'admin',
      email: 'admin@hestonautomotive.com',
      phoneNumber: '07000000000',
    });

    await adminUser.save();

    console.log('Admin user created successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

importData();
