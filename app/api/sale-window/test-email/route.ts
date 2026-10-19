import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { SALE_WINDOW_EMAILS, sendSaleWindowReminder } from '@/lib/saleWindow';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    const result = await sendSaleWindowReminder();
    return Response.json({ ...result, to: SALE_WINDOW_EMAILS });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Could not send the email' }, { status: 500 });
  }
}
