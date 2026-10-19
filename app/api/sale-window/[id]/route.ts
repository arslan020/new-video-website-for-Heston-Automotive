import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    }

    const body = await req.json();
    const hasSold = typeof body.sold === 'boolean';
    const hasType = body.vehicleType === 'Stock' || body.vehicleType === 'Demo' || body.vehicleType === 'New';
    if (!hasSold && !hasType) {
      return Response.json({ message: 'Nothing to update' }, { status: 400 });
    }

    const update: { vehicleType?: 'Stock' | 'Demo'; soldAt?: Date | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (hasType) update.vehicleType = body.vehicleType === 'Demo' ? 'Demo' : 'Stock';
    if (hasSold) update.soldAt = body.sold ? new Date() : null;

    await connectDB();
    const result = await SaleWindow.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    }

    const record = await SaleWindow.findById(id);
    if (!record) return Response.json({ message: 'Vehicle not found' }, { status: 404 });
    return Response.json(toView(record, utcToday()));
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update vehicle' }, { status: 500 });
  }
}
