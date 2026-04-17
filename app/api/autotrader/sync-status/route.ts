import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Stock from '@/models/Stock';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID!;
    const stockRecord = await Stock.findOne({ advertiserId });

    return Response.json({
      lastSyncTime: stockRecord?.lastSyncTime || null,
      syncStatus: stockRecord?.syncStatus || 'unknown',
      totalVehicles: stockRecord?.totalVehicles || 0,
      nextSyncTimes: ['06:00', '12:00', '18:00'],
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch sync status' }, { status: 500 });
  }
}
