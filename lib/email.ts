import { Resend } from 'resend';

const EMAIL_FROM = process.env.EMAIL_FROM || 'Heston Automotive <enquiries@hestonautomotive.com>';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to .env (same as car-video-portal backend).'
    );
  }
  return new Resend(key);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) throw new Error(error.message);
  return data;
}
