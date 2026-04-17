import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/mongodb';
import MagicLink from '@/models/MagicLink';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { videoId } = await req.json();

    if (!videoId) return Response.json({ message: 'Video ID is required' }, { status: 400 });

    const video = await Video.findById(videoId);
    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 4);

    const magicLink = await MagicLink.create({ token, video: videoId, createdBy: user._id, expiresAt });

    const frontendUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://video.hestonautomotive.com'
        : 'http://localhost:3000';

    return Response.json(
      { token: magicLink.token, expiresAt: magicLink.expiresAt, url: `${frontendUrl}/watch/${magicLink.token}` },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to generate link' }, { status: 500 });
  }
}
