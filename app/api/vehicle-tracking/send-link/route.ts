import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import VehicleTracking from '@/models/VehicleTracking';
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
    const { trackLink, email, mobile, vehicleDetails, customerName, customerTitle, stockId } = await req.json();

    if (!trackLink) {
      return Response.json({ message: 'Missing tracking link' }, { status: 400 });
    }
    if (!email && !mobile) {
      return Response.json({ message: 'Please provide an email address or mobile number' }, { status: 400 });
    }

    const results: { email: string | null; sms: string | null; smsError?: string | null } = { email: null, sms: null, smsError: null };
    const formattedName = capitalizeWords(customerName || '');
    const greetingName = formattedName ? `${customerTitle ? customerTitle + ' ' : ''}${formattedName}` : 'Customer';
    if (stockId && formattedName && greetingName !== 'Customer') {
      await VehicleTracking.updateOne({ stockId }, { $set: { customerName: greetingName } });
    }
    const vehicleName = `${vehicleDetails?.make ?? ''} ${vehicleDetails?.model ?? ''}`.trim();

    if (email) {
      try {
        // PNG, not webp — some email clients (e.g. Gmail) render the webp logo as a broken black box.
        const logoUrl = 'https://video.hestonautomotive.com/business-logo-email.png';
        const year = new Date().getFullYear();

        await sendEmail({
          to: email,
          subject: `Track Your Vehicle: ${vehicleName}`,
          html: `
            <div style="margin:0;padding:0;background-color:#eef0f5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f5;padding:24px 12px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(30,27,75,0.08);font-family:Arial,Helvetica,sans-serif;">
                      <tr><td style="height:6px;background:linear-gradient(90deg,#2563eb,#60a5fa);font-size:0;line-height:0;">&nbsp;</td></tr>

                      <tr>
                        <td align="center" style="padding:32px 40px 20px;">
                          <img src="${logoUrl}" alt="Changan Heston Automotive" width="220" style="display:block;width:220px;max-width:60%;height:auto;" />
                        </td>
                      </tr>
                      <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eceef3;font-size:0;line-height:0;">&nbsp;</div></td></tr>

                      <tr>
                        <td style="padding:28px 40px 8px;">
                          <span style="display:inline-block;background-color:#eaf1fe;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px;">Order Update</span>
                          <h1 style="margin:18px 0 10px;font-size:26px;line-height:1.2;color:#16182b;">Track Your Vehicle&rsquo;s Status</h1>
                          <p style="margin:0;font-size:15px;line-height:1.6;color:#555b6b;">
                            Dear <strong style="color:#16182b;">${greetingName}</strong>, you can now track the progress of your <strong style="color:#16182b;">${vehicleName}</strong> right up until handover.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:22px 40px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #eceef3;border-radius:10px;">
                            <tr>
                              <td align="center" style="padding:28px 24px;">
                                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6b7280;">Click below to see your vehicle&rsquo;s current stage, updated live.</p>
                                <a href="${trackLink}" style="background-color:#22a447;color:#ffffff;padding:15px 36px;text-decoration:none;border-radius:30px;display:inline-block;font-weight:700;font-size:15px;">&#128663;&nbsp; Track My Vehicle</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding:22px 40px 32px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef3fc;border-radius:10px;">
                            <tr>
                              <td align="center" style="padding:20px 24px;">
                                <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Have questions? We&rsquo;re here to help.</p>
                                <p style="margin:0;font-size:14px;">
                                  <a href="tel:02085648030" style="color:#2563eb;text-decoration:none;font-weight:600;">020 8564 8030</a>
                                  <span style="color:#c2c8d4;">&nbsp;&middot;&nbsp;</span>
                                  <a href="mailto:enquiries@hestonautomotive.com" style="color:#2563eb;text-decoration:none;font-weight:600;">enquiries@hestonautomotive.com</a>
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td align="center" style="background-color:#1e1b4b;padding:22px 40px;">
                          <p style="margin:0 0 6px;font-size:12px;color:#ffffff;">&copy; ${year} Heston Automotive. All rights reserved.</p>
                          <p style="margin:0;font-size:12px;color:#9d9bc4;">This email was sent regarding your order for the ${vehicleName}.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>
          `,
        });
        results.email = 'sent';
      } catch (emailErr) {
        console.error('Tracking link email send error:', emailErr);
        results.email = 'failed';
      }
    }

    if (mobile) {
      try {
        const smsMessage = `Hi ${greetingName}, you can track your ${vehicleName}'s status here: ${trackLink} - Heston Automotive`;
        await sendSMS(mobile, smsMessage);
        results.sms = 'sent';
      } catch (smsErr) {
        const smsMessage = smsErr instanceof Error ? smsErr.message : 'SMS failed to send';
        console.error('Tracking link SMS send error:', smsMessage);
        results.sms = 'failed';
        results.smsError = smsMessage;
      }
    }

    await AuditLog.create({
      action: 'SEND_TRACKING_LINK',
      user: user._id,
      details: `Sent tracking link for ${vehicleName} to ${email || mobile}`,
      targetId: stockId || undefined,
      metadata: { registration: vehicleDetails?.registration, sentTo: email || mobile, sentToEmail: email || null, sentToMobile: mobile || null, customerName: customerName || null },
    });

    return Response.json({ message: 'Send request processed', results });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to process send request' }, { status: 500 });
  }
}
