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

    // Only count real customer visits, not staff previewing the link, and not the
    // dashboard's own polling of /api/vehicle-tracking (that hits the list route, not this one).
    const user = await getUserFromRequest(req);
    const isStaff = user && (user.role === 'admin' || user.role === 'staff');
    if (!isStaff) {
      record.lastViewedAt = new Date();
      await record.save();
    }

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
      isPreOrder: record.isPreOrder || false,
      customerName: record.customerName,
      reviewEnabled: Boolean(record.reviewEnabled),
      remarks: record.remarks.map((r) => ({
        stage: r.stage,
        text: r.text,
        createdAt: r.createdAt,
        customerReply: r.customerReply,
        repliedAt: r.repliedAt,
      })),
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
    const {
      stage, vin, registration, make, model, derivative, colour, image,
      isPreOrder, customerName, customerEmail, customerMobile, colourOnly,
    } = body;

    if (colourOnly) {
      if (!colour) return Response.json({ message: 'Colour is required' }, { status: 400 });
      const record = await VehicleTracking.findOneAndUpdate(
        { stockId },
        { $set: { colour, ...(image !== undefined && { image }) } },
        { new: true }
      );
      if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });
      return Response.json(record);
    }

    if (body.reviewOnly) {
      const record = await VehicleTracking.findOneAndUpdate(
        { stockId },
        { $set: { reviewEnabled: Boolean(body.reviewEnabled) } },
        { new: true }
      );
      if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });
      return Response.json(record);
    }

    if (!isValidStage(stage)) {
      return Response.json({ message: 'Invalid stage' }, { status: 400 });
    }

    const existing = await VehicleTracking.findOne({ stockId });
    if (!existing) {
      if (stage !== 0) {
        return Response.json({ message: 'A new order starts at Order Confirmed' }, { status: 400 });
      }
    } else if (stage !== existing.currentStage + 1 && stage !== existing.currentStage - 1) {
      return Response.json({ message: 'A step can only move forward or back by one' }, { status: 400 });
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
          ...(isPreOrder !== undefined && { isPreOrder }),
          ...(customerName !== undefined && { customerName }),
          ...(customerEmail !== undefined && { customerEmail }),
          ...(customerMobile !== undefined && { customerMobile }),
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ stockId: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    await connectDB();
    const { stockId } = await params;
    const record = await VehicleTracking.findOneAndDelete({ stockId });

    if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });

    await AuditLog.create({
      action: 'UPDATE_VEHICLE_STAGE',
      user: user._id,
      details: `Deleted ${record.isPreOrder ? 'customer order' : 'tracking record'} for ${record.make || ''} ${record.model || ''}${record.customerName ? ` (${record.customerName})` : ''}`,
      targetId: stockId,
      metadata: { deleted: true, customerName: record.customerName || null },
    });

    return Response.json({ message: 'Tracking record deleted' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to delete tracking record' }, { status: 500 });
  }
}
