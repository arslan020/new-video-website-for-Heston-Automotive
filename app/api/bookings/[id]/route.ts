import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Booking from '@/models/Booking';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const booking = await Booking.findById(id).populate('videoId', 'title registration make model');
    if (!booking) return Response.json({ message: 'Booking not found' }, { status: 404 });
    return Response.json(booking);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch booking' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const booking = await Booking.findByIdAndUpdate(id, body, { new: true });
    if (!booking) return Response.json({ message: 'Booking not found' }, { status: 404 });
    return Response.json(booking);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to update booking' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { id } = await params;
    await Booking.findByIdAndDelete(id);
    return Response.json({ message: 'Booking deleted' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to delete booking' }, { status: 500 });
  }
}
