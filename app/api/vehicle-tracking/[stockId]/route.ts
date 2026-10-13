import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleTracking from '@/models/VehicleTracking';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { TRACKING_STAGES, isValidStage } from '@/lib/trackingStages';

// Public — used by the customer-facing tracking page, no auth required.
export async function GET(req: NextRequest, { params }: { params: Promise<{ stockId: string }> }) {
  try {
    await connectDB();
    const { stockId } = await params;
    const record = await VehicleTracking.findOne({ stockId });

    if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });

    return Response.json({
      stockId: record.stockId,
      registration: record.registration,
      make: record.make,
      model: record.model,
      derivative: record.derivative,
      colour: record.colour,
      image: record.image,
      currentStage: record.currentStage,
      updatedAt: record.updatedAt,
      stages: TRACKING_STAGES,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch tracking record' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ stockId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    const { stockId } = await params;
    const body = await req.json();
    const { stage, vin, registration, make, model, derivative, colour, image } = body;

    if (!isValidStage(stage)) {
      return Response.json({ message: 'Invalid stage' }, { status: 400 });
    }

    const record = await VehicleTracking.findOneAndUpdate(
      { stockId },
      {
        $set: {
          currentStage: stage,
          ...(vin !== undefined && { vin }),
          ...(registration !== undefined && { registration }),
          ...(make !== undefined && { make }),
          ...(model !== undefined && { model }),
          ...(derivative !== undefined && { derivative }),
          ...(colour !== undefined && { colour }),
          ...(image !== undefined && { image }),
        },
        $push: { stageHistory: { stage, updatedAt: new Date(), updatedBy: user._id } },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await AuditLog.create({
      action: 'UPDATE_VEHICLE_STAGE',
      user: user._id,
      details: `Set ${record.make || ''} ${record.model || ''} (${stockId}) to stage "${TRACKING_STAGES[stage]}"`,
      targetId: stockId,
      metadata: { stage, stageName: TRACKING_STAGES[stage] },
    });

    return Response.json(record);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update tracking record' }, { status: 500 });
  }
}
