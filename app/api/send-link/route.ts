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
        // Always use the public production URL so the logo loads in email clients
        // (deriving from finalVideoLink would break for localhost / preview domains).
        const logoUrl = 'https://video.hestonautomotive.com/business-logo.png';
        const vehicleName = `${vehicleDetails?.make ?? ''} ${vehicleDetails?.model ?? ''}`.trim();
        const year = new Date().getFullYear();

        await sendEmail({
          to: email,
          subject: `Your Video Presentation – ${vehicleName}`,
          html: `
            <div style="margin:0;padding:0;background-color:#eef0f5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f5;padding:24px 12px;">
                <tr>
                  <td align="center">
                    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(30,27,75,0.08);font-family:Arial,Helvetica,sans-serif;">
                      <!-- top accent bar -->
                      <tr><td style="height:6px;background:linear-gradient(90deg,#2563eb,#60a5fa);font-size:0;line-height:0;">&nbsp;</td></tr>

                      <!-- logo -->
                      <tr>
                        <td align="center" style="padding:32px 40px 20px;">
                          <img src="${logoUrl}" alt="Heston Automotive" width="200" style="display:block;width:200px;max-width:60%;height:auto;" />
                        </td>
                      </tr>
                      <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eceef3;font-size:0;line-height:0;">&nbsp;</div></td></tr>

                      <!-- intro -->
                      <tr>
                        <td style="padding:28px 40px 8px;">
                          <span style="display:inline-block;background-color:#eaf1fe;color:#2563eb;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:20px;">Personalised For You</span>
                          <h1 style="margin:18px 0 10px;font-size:26px;line-height:1.2;color:#16182b;">Your Video Presentation</h1>
                          <p style="margin:0;font-size:15px;line-height:1.6;color:#555b6b;">
                            Dear <strong style="color:#16182b;">${greetingName}</strong>, thank you for your interest in the <strong style="color:#16182b;">${vehicleName}</strong>.
                            We&rsquo;ve prepared a detailed video walkthrough just for you.
                          </p>
                        </td>
                      </tr>

                      <!-- vehicle of interest -->
                      <tr>
                        <td style="padding:22px 40px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8fa;border:1px solid #eceef3;border-left:4px solid #2563eb;border-radius:10px;">
                            <tr>
                              <td style="padding:18px 22px;">
                                <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9aa1b0;margin-bottom:6px;">Vehicle Of Interest</div>
                                <div style="font-size:20px;font-weight:700;color:#16182b;">${vehicleName}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- watch button -->
                      <tr>
                        <td style="padding:22px 40px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #eceef3;border-radius:10px;">
                            <tr>
                              <td align="center" style="padding:28px 24px;">
                                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#6b7280;">Click below to watch the full video presentation showcasing the features and condition of this vehicle.</p>
                                <a href="${finalVideoLink}" style="background-color:#22a447;color:#ffffff;padding:15px 36px;text-decoration:none;border-radius:30px;display:inline-block;font-weight:700;font-size:15px;">&#9654;&nbsp; Watch Video Presentation</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- help / expiry -->
                      <tr>
                        <td style="padding:22px 40px 32px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef3fc;border-radius:10px;">
                            <tr>
                              <td align="center" style="padding:20px 24px;">
                                <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Note: For security, this link will expire in 4 days.</p>
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

                      <!-- footer -->
                      <tr>
                        <td align="center" style="background-color:#1e1b4b;padding:22px 40px;">
                          <p style="margin:0 0 6px;font-size:12px;color:#ffffff;">&copy; ${year} Heston Automotive. All rights reserved.</p>
                          <p style="margin:0;font-size:12px;color:#9d9bc4;">This email was sent regarding your enquiry about ${vehicleName}.</p>
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
