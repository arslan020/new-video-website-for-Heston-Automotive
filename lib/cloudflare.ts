const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const CLOUDFLARE_CUSTOMER_SUBDOMAIN = process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN!;

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`;

export async function createCloudflareUploadUrl(metadata: Record<string, string> = {}) {
  const res = await fetch(`${CF_BASE}/direct_upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds: 3600,
      meta: metadata,
    }),
  });

  if (!res.ok) throw new Error(`Cloudflare upload URL error: ${res.statusText}`);
  return res.json();
}

export async function deleteCloudflareVideo(videoId: string) {
  const res = await fetch(`${CF_BASE}/${videoId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  return res.ok;
}

export function getCloudflareEmbedUrl(videoId: string) {
  return `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/iframe`;
}

export function getCloudflareStreamUrl(videoId: string) {
  return `https://${CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/manifest/video.m3u8`;
}
