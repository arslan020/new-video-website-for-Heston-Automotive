import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb';
import Video from '../models/Video';
import Stock from '../models/Stock';

const run = async () => {
  try {
    await connectDB();
    console.log('Starting migration: Updating Video details from Stock...');

    const videos = await Video.find({ registration: { $exists: true, $ne: null } });
    const stockRecord = await Stock.findOne({ advertiserId: process.env.AUTOTRADER_ADVERTISER_ID });

    if (!stockRecord?.stockData?.length) {
      console.log('No stock data found to sync from.');
      process.exit(1);
    }

    let updatedCount = 0;

    for (const video of videos) {
      if (!video.registration) continue;

      const videoReg = video.registration.replace(/\s+/g, '').toUpperCase();

      const matchingStock = (stockRecord.stockData as any[]).find((item: any) => {
        const stockReg = item.vehicle?.registration?.replace(/\s+/g, '').toUpperCase();
        return stockReg === videoReg;
      });

      if (matchingStock) {
        const tech = matchingStock.techSpecs || {};
        const metrics = matchingStock.vehicleMetrics || {};
        const core = matchingStock.vehicle || {};

        video.vehicleDetails = {
          ...matchingStock,
          ...core,
          ...tech,
          ...metrics,
        };

        await video.save();
        updatedCount++;
        console.log(`Updated: ${video.title} (${video.registration})`);
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} videos.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

run();
