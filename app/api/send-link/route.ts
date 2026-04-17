import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import AuditLog from '@/models/AuditLog';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    await connectDB();
    const { videoLink, email, mobile, vehicleDetails, customerName, customerTitle } = await req.json();

    if (!email && !mobile) {
      return Response.json({ message: 'Please provide an email address or mobile number' }, { status: 400 });
    }

    const results: { email: string | null; sms: string | null; smsError?: string | null } = { email: null, sms: null, smsError: null };
    const formattedName = capitalizeWords(customerName || '');
    const greetingName = formattedName ? `${customerTitle ? customerTitle + ' ' : ''}${formattedName}` : 'Customer';

    let shareId = null;
    let finalVideoLink = videoLink;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 4);

    try {
      const urlObj = new URL(videoLink);
      const pathSegments = urlObj.pathname.split('/');
      const viewIndex = pathSegments.indexOf('view');
      let videoId = null;
      if (viewIndex !== -1 && pathSegments.length > viewIndex + 1) {
        videoId = pathSegments[viewIndex + 1];
      }

      if (videoId && /^[a-f\d]{24}$/i.test(videoId)) {
        const log = await AuditLog.create({
          action: 'SEND_VIDEO_LINK',
          user: user._id,
          details: `Sent video link for ${vehicleDetails?.make} ${vehicleDetails?.model} to ${email || mobile}. Expiry set to 4 days.`,
          targetId: videoId,
          metadata: { registration: vehicleDetails?.registration, expiresAt, sentTo: email || mobile, sentToEmail: email || null, sentToMobile: mobile || null, customerName: customerName || null },
        });
        shareId = log._id;

        await Video.findByIdAndUpdate(videoId, { linkExpiresAt: expiresAt });

        urlObj.searchParams.append('s', shareId.toString());
        const senderName = user?.name || user?.username || '';
        if (senderName) urlObj.searchParams.append('ref', encodeURIComponent(senderName));
        finalVideoLink = urlObj.toString();
      }
    } catch (err) {
      console.error('Failed to generate share token:', err);
    }

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: `Your Video Presentation – ${vehicleDetails?.make} ${vehicleDetails?.model}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
              <h2>Your Video Presentation</h2>
              <p>Dear <strong>${greetingName}</strong>, thank you for your interest in the <strong>${vehicleDetails?.make} ${vehicleDetails?.model}</strong>.</p>
              <p><a href="${finalVideoLink}" style="background:#28a745;color:#fff;padding:12px 30px;text-decoration:none;border-radius:25px;display:inline-block;font-weight:600;">▶ Watch Video Presentation</a></p>
              <p style="color:#888;font-size:12px;">For security, this link will expire in 4 days.</p>
              <p>Have questions? Call <a href="tel:02085648030">020 8564 8030</a> or email <a href="mailto:enquiries@hestonautomotive.com">enquiries@hestonautomotive.com</a></p>
            </div>
          `,
        });
        results.email = 'sent';
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
        results.email = 'failed';
      }
    }

    if (mobile) {
      try {
        const smsMessage = `Hi ${greetingName}, here's your personalised video for the ${vehicleDetails?.make} ${vehicleDetails?.model} from Heston Automotive: ${finalVideoLink}`;
        await sendSMS(mobile, smsMessage);
        results.sms = 'sent';
      } catch (smsErr) {
        const smsMessage = smsErr instanceof Error ? smsErr.message : 'SMS failed to send';
        console.error('SMS send error:', smsMessage);
        results.sms = 'failed';
        results.smsError = smsMessage;
      }
    }

    return Response.json({ message: 'Send request processed', results });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to process send request' }, { status: 500 });
  }
}
