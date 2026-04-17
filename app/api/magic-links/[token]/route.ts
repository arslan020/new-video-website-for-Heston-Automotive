import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import MagicLink from '@/models/MagicLink';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    await connectDB();
    const { token } = await params;

    const magicLink = await MagicLink.findOne({ token }).populate({
      path: 'video',
      populate: { path: 'uploadedBy', select: 'name username' },
    });

    if (!magicLink) return Response.json({ message: 'Link expired or invalid' }, { status: 404 });

    if (new Date() > magicLink.expiresAt) {
      return Response.json({ message: 'Link expired' }, { status: 410 });
    }

    return Response.json(magicLink.video);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Server error' }, { status: 500 });
  }
}
