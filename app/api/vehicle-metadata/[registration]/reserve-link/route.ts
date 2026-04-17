import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleMetadata from '@/models/VehicleMetadata';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ registration: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { registration } = await params;
    const reg = registration.toUpperCase().trim();
    const { reserveLink } = await req.json();

    let metadata = await VehicleMetadata.findOne({ registration: reg });
    if (!metadata) {
      metadata = new VehicleMetadata({ registration: reg, reserveLink: reserveLink || '' });
    } else {
      metadata.reserveLink = reserveLink || '';
    }

    await metadata.save();
    return Response.json({ message: 'Reserve link updated successfully', metadata });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update reserve link' }, { status: 500 });
  }
}
