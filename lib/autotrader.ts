import axios from 'axios';
import { connectDB } from './mongodb';
import Stock from '@/models/Stock';

export async function fetchAllStockFromAutoTrader() {
  try {
    await connectDB();
    const key = process.env.AUTOTRADER_KEY!;
    const secret = process.env.AUTOTRADER_SECRET!;
    const advertiserId = process.env.AUTOTRADER_ADVERTISER_ID!;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingLock = await Stock.findOne({ advertiserId, syncStatus: 'in_progress', updatedAt: { $gt: tenMinutesAgo } });
    if (existingLock) return { success: false, message: 'Sync already in progress' };

    await Stock.findOneAndUpdate({ advertiserId }, { syncStatus: 'in_progress' }, { upsert: true });

    const tokenResponse = await axios.post(
      'https://api.autotrader.co.uk/authenticate',
      new URLSearchParams({ key, secret }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenResponse.data.access_token;

    let allStock: unknown[] = [];
    let currentPage = 1;
    let totalPages = 1;
    const PAGE_SIZE = 100;

    do {
      const stockResponse = await axios.get(
        `https://api.autotrader.co.uk/stock?advertiserId=${advertiserId}&page=${currentPage}&pageSize=${PAGE_SIZE}&features=true`,
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } }
      );

      if (currentPage === 1) {
        const totalResults = stockResponse.data.totalResults || stockResponse.data.results?.length || 0;
        totalPages = Math.ceil(totalResults / PAGE_SIZE);
      }

      if (stockResponse.data.results) {
        const activeStock = stockResponse.data.results.filter((v: { metadata?: { lifecycleState?: string } }) => {
          const status = v.metadata?.lifecycleState;
          return status === 'FORECOURT' || status === 'DUE_IN';
        });
        allStock = [...allStock, ...activeStock];
      }
      currentPage++;
    } while (currentPage <= totalPages);

    await Stock.findOneAndUpdate(
      { advertiserId },
      { stockData: allStock, lastSyncTime: new Date(), totalVehicles: allStock.length, syncStatus: 'success' },
      { upsert: true, new: true }
    );

    return { success: true, totalVehicles: allStock.length };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    await Stock.findOneAndUpdate(
      { advertiserId: process.env.AUTOTRADER_ADVERTISER_ID },
      { syncStatus: 'failed' },
      { upsert: true }
    );
    return { success: false, error: msg };
  }
}
