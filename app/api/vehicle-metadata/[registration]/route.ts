import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import VehicleMetadata from '@/models/VehicleMetadata';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ registration: string }> }) {
  try {
    await connectDB();
    const { registration } = await params;
    const reg = registration.toUpperCase().trim();
    const metadata = await VehicleMetadata.findOne({ registration: reg });

    if (!metadata) return Response.json({ registration: reg, reserveLink: '' });
    return Response.json(metadata);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to get vehicle metadata' }, { status: 500 });
  }
}
