import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin') return forbiddenResponse();

  try {
    const accessKey = process.env.BIRD_ACCESS_KEY;
    const workspaceId = process.env.BIRD_WORKSPACE_ID;

    if (!accessKey || !workspaceId) {
      return Response.json({ message: 'Bird API credentials not configured' }, { status: 500 });
    }

    const response = await fetch(`https://api.bird.com/workspaces/${workspaceId}/wallets`, {
      headers: {
        Authorization: `AccessKey ${accessKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return Response.json({ message: `Bird API error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to fetch Bird balance' }, { status: 500 });
  }
}
