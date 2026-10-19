import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import SaleWindow from '@/models/SaleWindow';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { toView, utcToday } from '@/lib/saleWindow';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const { id } = await params;
    const body = await req.json();
    if (typeof body.sold !== 'boolean') {
      return Response.json({ message: 'sold must be true or false' }, { status: 400 });
    }

    await connectDB();
    const record = await SaleWindow.findById(id);
    if (!record) return Response.json({ message: 'Vehicle not found' }, { status: 404 });

    record.soldAt = body.sold ? new Date() : null;
    await record.save();
    return Response.json(toView(record, utcToday()));
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update vehicle' }, { status: 500 });
  }
}
