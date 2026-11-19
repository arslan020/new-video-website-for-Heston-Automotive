import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { searchMotorDeskCustomers } from '@/lib/motordesk';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  const query = new URL(req.url).searchParams.get('q') || '';
  const limit = Number(new URL(req.url).searchParams.get('limit') || '8');
  if (query.trim().length < 2) return Response.json({ customers: [] });

  try {
    const customers = await searchMotorDeskCustomers(query, limit);
    return Response.json({ customers });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Could not search Motor Desk customers' }, { status: 502 });
  }
}
