import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { getMotorDeskCustomer } from '@/lib/motordesk';
import { sendSMS } from '@/lib/sms';

const MAX_RECIPIENTS = 60;
const MAX_MESSAGE = 480;

async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await task(current);
    }
  });
  await Promise.all(workers);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const body = await req.json();
    const message = String(body.message || '').trim();
    const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
    const ids: number[] = [];
    for (const value of rawIds) {
      const id = Number(value);
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    }

    if (!message) return Response.json({ message: 'Write a message first' }, { status: 400 });
    if (message.length > MAX_MESSAGE) {
      return Response.json({ message: `Message must be ${MAX_MESSAGE} characters or less` }, { status: 400 });
    }
    if (ids.length === 0) return Response.json({ message: 'Select at least one customer' }, { status: 400 });
    if (ids.length > MAX_RECIPIENTS) {
      return Response.json({ message: `Select up to ${MAX_RECIPIENTS} customers` }, { status: 400 });
    }

    const failed: { name: string; reason: string }[] = [];
    let sent = 0;

    await eachLimited(ids, 5, async (id) => {
      let customer;
      try {
        customer = await getMotorDeskCustomer(id);
      } catch {
        failed.push({ name: `Contact ${id}`, reason: 'Could not load this customer' });
        return;
      }
      if (!customer) {
        failed.push({ name: `Contact ${id}`, reason: 'Customer not found' });
        return;
      }
      if (!customer.mobile) {
        failed.push({ name: customer.name || `Contact ${id}`, reason: 'No mobile number' });
        return;
      }
      try {
        await sendSMS(customer.mobile, message);
        sent += 1;
      } catch (err) {
        console.error('Offer SMS failed', id, err);
        failed.push({ name: customer.name || `Contact ${id}`, reason: 'SMS failed' });
      }
    });

    return Response.json({ sent, failed });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to send the offer' }, { status: 500 });
  }
}
