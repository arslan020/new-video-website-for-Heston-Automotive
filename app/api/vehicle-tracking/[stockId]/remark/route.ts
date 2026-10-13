import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleTracking from '@/models/VehicleTracking';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { isValidStage } from '@/lib/trackingStages';

// Staff/admin — add or edit the remark left for a specific stage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ stockId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    const { stockId } = await params;
    const { stage, text } = await req.json();

    if (!isValidStage(stage)) {
      return Response.json({ message: 'Invalid stage' }, { status: 400 });
    }
    if (!text || !text.trim()) {
      return Response.json({ message: 'Remark text is required' }, { status: 400 });
    }

    const record = await VehicleTracking.findOne({ stockId });
    if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });

    const existing = record.remarks.find((r) => r.stage === stage);
    if (existing) {
      existing.text = text.trim();
      existing.createdAt = new Date();
      existing.createdBy = user._id;
    } else {
      record.remarks.push({ stage, text: text.trim(), createdAt: new Date(), createdBy: user._id });
    }
    await record.save();

    await AuditLog.create({
      action: 'ADD_VEHICLE_REMARK',
      user: user._id,
      details: `Left a remark on ${record.make || ''} ${record.model || ''} at stage ${stage + 1}`,
      targetId: stockId,
      metadata: { stage, text: text.trim() },
    });

    return Response.json(record);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to save remark' }, { status: 500 });
  }
}
