import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { listMotorDeskStock } from '@/lib/motordesk';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const vehicles = await listMotorDeskStock();
    return Response.json(vehicles);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Could not load Motor Desk stock' }, { status: 502 });
  }
}
