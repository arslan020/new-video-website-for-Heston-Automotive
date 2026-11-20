import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { getMotorDeskCustomer } from '@/lib/motordesk';
import SmsTemplate, { ISmsTemplateCustomer } from '@/models/SmsTemplate';

const MAX_RECIPIENTS = 60;

function staffOnly(role: string) {
  return role === 'admin' || role === 'staff';
}

function present(template: { _id: unknown; name: string; body: string; customers?: ISmsTemplateCustomer[] }) {
  return {
    id: String(template._id),
    name: template.name,
    body: template.body || '',
    customers: (template.customers || []).map((customer) => ({
      id: customer.motordeskId,
      name: customer.name,
      mobile: customer.mobile,
    })),
  };
}

async function resolveCustomers(ids: unknown, previous: ISmsTemplateCustomer[]) {
  const raw: unknown[] = Array.isArray(ids) ? ids : [];
  const unique: number[] = [];
  for (const value of raw) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0 && !unique.includes(id)) unique.push(id);
  }
  if (unique.length > MAX_RECIPIENTS) {
    return { error: `You can save up to ${MAX_RECIPIENTS} customers on one template` };
  }
  const known = new Map(previous.map((customer) => [customer.motordeskId, customer]));
  const customers: ISmsTemplateCustomer[] = [];
  for (const id of unique) {
    const existing = known.get(id);
    if (existing?.mobile) {
      customers.push({ motordeskId: id, name: existing.name, mobile: existing.mobile });
      continue;
    }
    const customer = await getMotorDeskCustomer(id);
    if (!customer) return { error: 'Customer not found' };
    if (!customer.mobile) return { error: 'This customer has no mobile number' };
    customers.push({ motordeskId: id, name: customer.name || 'Customer', mobile: customer.mobile });
  }
  return { customers };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (!staffOnly(user.role)) return forbiddenResponse();

  await connectDB();
  const templates = await SmsTemplate.find().sort({ createdAt: 1 }).lean();
  return Response.json(templates.map((template) => present(template)));
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (!staffOnly(user.role)) return forbiddenResponse();

  const payload = await req.json().catch(() => ({}));
  const name = String(payload.name || '').trim();
  const message = String(payload.body || '').trim();
  if (!name || name.length > 60) return Response.json({ message: 'Give the template a name, up to 60 characters' }, { status: 400 });
  if (message.length > 480) return Response.json({ message: 'Message must be 480 characters or less' }, { status: 400 });

  await connectDB();
  const id = String(payload.id || '');
  const current = id ? await SmsTemplate.findById(id) : null;
  if (id && !current) return Response.json({ message: 'Template not found' }, { status: 404 });

  let customers = current?.customers || [];
  if (Array.isArray(payload.customerIds)) {
    try {
      const resolved = await resolveCustomers(payload.customerIds, customers);
      if (resolved.error || !resolved.customers) return Response.json({ message: resolved.error || 'Could not save customers' }, { status: 400 });
      customers = resolved.customers;
    } catch {
      return Response.json({ message: 'Could not load this customer' }, { status: 502 });
    }
  }

  if (current) {
    current.name = name;
    current.body = message;
    current.customers = customers;
    await current.save();
    return Response.json(present(current));
  }

  const created = await SmsTemplate.create({ name, body: message, customers });
  return Response.json(present(created), { status: 201 });
}
