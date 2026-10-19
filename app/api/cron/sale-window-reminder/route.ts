import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { sendMondayEmailOnce } from '@/lib/saleWindow';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const result = await sendMondayEmailOnce();
    return Response.json({ ...result, success: true });
  } catch (err) {
    console.error('[Days to Sell Cron] Error:', err);
    return Response.json({ error: 'Email failed' }, { status: 500 });
  }
}
