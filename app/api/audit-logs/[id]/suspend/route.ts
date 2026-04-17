import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const log = await AuditLog.findById(id);

    if (!log) return Response.json({ message: 'Share link not found' }, { status: 404 });

    if (!['SEND_VIDEO_LINK', 'SHARE_VIDEO_LINK'].includes(log.action)) {
      return Response.json({ message: 'This entry cannot be suspended' }, { status: 400 });
    }

    log.suspended = !log.suspended;
    await log.save();

    return Response.json({
      message: log.suspended ? 'Link suspended successfully' : 'Link enabled successfully',
      suspended: log.suspended,
      shareId: log._id,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to toggle link suspension' }, { status: 500 });
  }
}
