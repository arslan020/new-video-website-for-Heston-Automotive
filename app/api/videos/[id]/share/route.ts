import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const video = await Video.findById(id);

    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 4);

    video.linkExpiresAt = expiresAt;
    await video.save();

    const log = await AuditLog.create({
      action: 'SHARE_VIDEO_LINK',
      user: user._id,
      details: `Shared video link: ${video.title} (${video.registration || 'No Reg'}). Expiry set to 4 days.`,
      targetId: video._id?.toString(),
      metadata: { registration: video.registration, expiresAt },
    });

    return Response.json({ message: 'Link sharing registered, expiration set to 4 days', shareId: log._id, expiresAt });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to register link share' }, { status: 500 });
  }
}
