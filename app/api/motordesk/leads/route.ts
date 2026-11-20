import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { listMotorDeskLeads } from '@/lib/motordesk';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.role !== 'staff') return forbiddenResponse();

  try {
    const leads = await listMotorDeskLeads();
    return Response.json(leads);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.toLowerCase().includes('scope')) {
      return Response.json({ message: 'Turn on Leads Read and Lead Vehicles Read in Motor Desk, then refresh.' }, { status: 403 });
    }
    console.error(err);
    return Response.json({ message: 'Could not load Motor Desk leads' }, { status: 502 });
  }
}
