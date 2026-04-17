import { connectDB } from '@/lib/mongodb';
import VehicleMetadata from '@/models/VehicleMetadata';

export async function GET() {
  try {
    await connectDB();
    const metadata = await VehicleMetadata.find({});
    return Response.json(metadata);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to get vehicle metadata' }, { status: 500 });
  }
}
