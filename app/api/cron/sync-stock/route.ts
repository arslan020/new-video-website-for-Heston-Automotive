import { NextRequest } from 'next/server';
import { fetchAllStockFromAutoTrader } from '@/lib/autotrader';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[AutoTrader Cron] Starting scheduled sync...');
    const result = await fetchAllStockFromAutoTrader();
    console.log('[AutoTrader Cron] Done:', result);
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error('[AutoTrader Cron] Error:', err);
    return Response.json({ error: 'Sync failed' }, { status: 500 });
  }
}
