import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Stock from '@/models/Stock';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { fetchAllStockFromAutoTrader } from '@/lib/autotrader';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID!;
    let stockRecord = await Stock.findOne({ advertiserId });

    if (!stockRecord) {
      await fetchAllStockFromAutoTrader();
      stockRecord = await Stock.findOne({ advertiserId });
    }

    return Response.json({
      results: stockRecord?.stockData || [],
      lastSyncTime: stockRecord?.lastSyncTime,
      totalVehicles: stockRecord?.totalVehicles || 0,
      syncStatus: stockRecord?.syncStatus || 'unknown',
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch stock' }, { status: 500 });
  }
}
