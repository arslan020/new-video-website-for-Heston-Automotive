import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Booking from '@/models/Booking';
import Video from '@/models/Video';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const url = new URL(req.url);
    const videoId = url.searchParams.get('videoId');
    const query: Record<string, unknown> = {};
    if (videoId) query.videoId = videoId;

    const bookings = await Booking.find(query)
      .populate('videoId', 'title registration make model')
      .sort({ createdAt: -1 });

    return Response.json(bookings);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { videoId, customerName, customerEmail, customerPhone, visitDate, visitTime, notes } = await req.json();

    if (!videoId || !customerName || !customerEmail || !customerPhone || !visitDate || !visitTime) {
      return Response.json({ message: 'All required fields must be provided' }, { status: 400 });
    }

    const video = await Video.findById(videoId);
    if (!video) return Response.json({ message: 'Video not found' }, { status: 404 });

    const booking = await Booking.create({
      videoId,
      customerName,
      customerEmail,
      customerPhone,
      visitDate: new Date(visitDate),
      visitTime,
      registration: video.registration,
      make: video.make,
      model: video.model,
      notes,
    });

    // Send confirmation email to customer
    try {
      const dateStr = new Date(visitDate).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      await sendEmail({
        to: customerEmail,
        subject: `Booking Confirmed – ${video.make} ${video.model}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333;">
            <h2 style="color: #2563EB;">Booking Confirmed!</h2>
            <p>Dear ${customerName},</p>
            <p>Your visit has been booked for the <strong>${video.make} ${video.model}</strong>.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Date:</strong> ${dateStr}</p>
              <p><strong>Time:</strong> ${visitTime}</p>
              <p><strong>Vehicle:</strong> ${video.make} ${video.model} (${video.registration || 'N/A'})</p>
            </div>
            <p>We look forward to seeing you! Call us on 020 8564 8030 if you need to make any changes.</p>
            <p>Heston Automotive</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Booking email failed:', emailErr);
    }

    // Send SMS notification to admin
    try {
      const dateStr = new Date(visitDate).toLocaleDateString('en-GB');
      await sendSMS(
        '07800000000',
        `New booking: ${customerName} for ${video.make} ${video.model} on ${dateStr} at ${visitTime}. Phone: ${customerPhone}`
      );
    } catch (smsErr) {
      console.error('Booking SMS failed:', smsErr);
    }

    return Response.json(booking, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to create booking' }, { status: 500 });
  }
}
