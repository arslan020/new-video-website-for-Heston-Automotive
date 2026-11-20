import { NextRequest } from 'next/server';
import { getUserFromRequest, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorizedResponse();

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN!;

  if (!accountId || !apiToken) {
    return Response.json({ message: 'Cloudflare credentials not configured' }, { status: 500 });
  }

  const uploadLength = req.headers.get('upload-length');
  const uploadMetadata = req.headers.get('upload-metadata');
  if (!uploadLength) {
    return Response.json({ message: 'Missing upload length' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': uploadLength,
        ...(uploadMetadata ? { 'Upload-Metadata': uploadMetadata } : {}),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('TUS create failed:', res.status, text);
    return Response.json({ message: 'Failed to create TUS upload' }, { status: 500 });
  }

  const tusUrl = res.headers.get('Location');
  const uid = res.headers.get('stream-media-id');

  if (!tusUrl || !uid) {
    return Response.json({ message: 'Missing Location or stream-media-id from Cloudflare' }, { status: 500 });
  }

  // 201 with Location is the tus creation response. The browser then uploads straight to that URL.
  return new Response(null, {
    status: 201,
    headers: {
      Location: tusUrl,
      'stream-media-id': uid,
      'Tus-Resumable': '1.0.0',
      'Access-Control-Expose-Headers': 'Location, stream-media-id',
    },
  });
}
