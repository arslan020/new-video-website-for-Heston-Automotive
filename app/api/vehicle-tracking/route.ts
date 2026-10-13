import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleTracking from '@/models/VehicleTracking';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    const records = await VehicleTracking.find({});
    return Response.json(records);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch vehicle tracking records' }, { status: 500 });
  }
}
