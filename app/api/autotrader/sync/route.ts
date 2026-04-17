import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { fetchAllStockFromAutoTrader } from '@/lib/autotrader';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin') return forbiddenResponse();

  try {
    const result = await fetchAllStockFromAutoTrader();
    return Response.json({
      message: result.success ? 'Stock synced successfully' : 'Stock sync failed',
      ...result,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to sync stock' }, { status: 500 });
  }
}
