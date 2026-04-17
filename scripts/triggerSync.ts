import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import { fetchAllStockFromAutoTrader } from '../lib/autotrader';

const run = async () => {
  try {
    await connectDB();
    console.log('Triggering manual AutoTrader sync...');
    const result = await fetchAllStockFromAutoTrader();
    console.log('Sync complete:', result);
    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
