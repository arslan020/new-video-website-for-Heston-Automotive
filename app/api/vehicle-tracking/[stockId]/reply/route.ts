import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleTracking from '@/models/VehicleTracking';
import { isValidStage } from '@/lib/trackingStages';

// Public — the customer replying to a remark left on their tracking page. No auth required.
export async function POST(req: NextRequest, { params }: { params: Promise<{ stockId: string }> }) {
  try {
    await connectDB();
    const { stockId } = await params;
    const { stage, reply } = await req.json();

    if (!isValidStage(stage)) {
      return Response.json({ message: 'Invalid stage' }, { status: 400 });
    }
    if (!reply || !reply.trim()) {
      return Response.json({ message: 'Reply text is required' }, { status: 400 });
    }

    const record = await VehicleTracking.findOne({ stockId });
    if (!record) return Response.json({ message: 'Tracking record not found' }, { status: 404 });

    const remark = record.remarks.find((r) => r.stage === stage);
    if (!remark) {
      return Response.json({ message: 'No remark to reply to at this stage' }, { status: 404 });
    }

    remark.customerReply = reply.trim();
    remark.repliedAt = new Date();
    await record.save();

    return Response.json({ message: 'Reply sent' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to send reply' }, { status: 500 });
  }
}
