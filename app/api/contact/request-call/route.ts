import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { sendEmail } from '@/lib/email';

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    let { name, phone, email, vehicleDetails, videoLink, shareId } = await req.json();

    if (shareId) {
      try {
        const log = await AuditLog.findById(shareId);
        if (log?.metadata) {
          const m = log.metadata as Record<string, string>;
          if (!name) name = m.customerName || '';
          if (!email) email = m.sentToEmail || (m.sentTo?.includes('@') ? m.sentTo : '') || '';
          if (!phone) phone = m.sentToMobile || (!m.sentTo?.includes('@') ? m.sentTo : '') || '';
        }
      } catch {}
    }

    if (!name && !phone && !email) {
      return Response.json({ message: 'Customer contact details are required' }, { status: 400 });
    }

    const formattedName = capitalizeWords(name || '');

    await sendEmail({
      to: 'rashid@hestonautomotive.com',
      subject: `📞 Call Request: ${vehicleDetails?.make} ${vehicleDetails?.model} — ${formattedName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
          <h2>📞 New Call Request</h2>
          <p><strong>Customer:</strong> ${formattedName}</p>
          <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
          ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
          <p><strong>Vehicle:</strong> ${vehicleDetails?.make} ${vehicleDetails?.model} (${vehicleDetails?.registration || 'N/A'})</p>
          ${videoLink ? `<p><a href="${videoLink}" style="background:#5b9bd5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">▶ Watch Video</a></p>` : ''}
          <p style="color:#5b9bd5;font-weight:600;">⚡ Please contact this customer as soon as possible</p>
        </div>
      `,
    });

    return Response.json({ message: 'Call request sent successfully' });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to send call request' }, { status: 500 });
  }
}
