import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const linksSentToday = await AuditLog.countDocuments({
      action: 'SEND_VIDEO_LINK',
      user: user._id,
      createdAt: { $gte: start, $lte: end },
    });

    return Response.json({ linksSentToday });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch today stats' }, { status: 500 });
  }
}
