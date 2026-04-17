import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN!;

    if (!accountId || !apiToken) {
      return Response.json({ message: 'Cloudflare credentials not configured' }, { status: 500 });
    }

    const { title } = await req.json();

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 3600,
          requireSignedURLs: false,
          meta: { name: title || 'Video Upload' },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ message: data.errors?.[0]?.message || 'Failed to get upload URL' }, { status: 500 });
    }

    return Response.json({
      uploadURL: data.result.uploadURL,
      uid: data.result.uid,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ message: 'Failed to create direct upload' }, { status: 500 });
  }
}
