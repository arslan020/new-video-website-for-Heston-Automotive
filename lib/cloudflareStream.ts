import axios from 'axios';
import * as tus from 'tus-js-client';
import fs from 'fs';

interface UploadMetadata {
  title?: string;
  onProgress?: (percent: number) => void;
}

interface CloudflareVideoResult {
  videoId: string;
  videoUrl: string;
  thumbnail?: string;
  duration?: number;
  status?: string;
}

export const uploadToCloudflareStream = async (
  filePath: string,
  metadata: UploadMetadata = {}
): Promise<CloudflareVideoResult> => {
  return new Promise((resolve, reject) => {
    try {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
      const apiToken = process.env.CLOUDFLARE_API_TOKEN!;

      if (!accountId || !apiToken) {
        throw new Error('Cloudflare Stream credentials not configured');
      }

      const fileSize = fs.statSync(filePath).size;
      const fileStream = fs.createReadStream(filePath);

      const upload = new tus.Upload(fileStream as unknown as File, {
        endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
        headers: { Authorization: `Bearer ${apiToken}` },
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: { name: metadata.title || 'Video Upload', requiresignedurls: 'false' },
        uploadSize: fileSize,
        onError: (error) => reject(error),
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = parseFloat(((bytesUploaded / bytesTotal) * 100).toFixed(2));
          if (metadata.onProgress) metadata.onProgress(percentage);
        },
        onSuccess: async () => {
          try {
            const videoId = (upload.url as string).split('/').pop()!;
            await new Promise((r) => setTimeout(r, 1000));

            await axios.post(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
              { requireSignedURLs: false },
              { headers: { Authorization: `Bearer ${apiToken}` } }
            );

            const response = await axios.get(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
              { headers: { Authorization: `Bearer ${apiToken}` } }
            );

            const video = response.data.result;
            resolve({
              videoId: video.uid,
              videoUrl: `https://${process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${video.uid}/iframe`,
              thumbnail: video.thumbnail,
              duration: video.duration,
              status: video.status.state,
            });
          } catch (fetchError: unknown) {
            const videoId = (upload.url as string).split('/').pop()!;
            resolve({
              videoId,
              videoUrl: `https://${process.env.CLOUDFLARE_CUSTOMER_SUBDOMAIN}/${videoId}/iframe`,
              status: 'ready',
            });
          }
        },
      });

      upload.start();
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteFromCloudflareStream = async (videoId: string): Promise<boolean> => {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN!;
    await axios.delete(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${videoId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    return true;
  } catch {
    return false;
  }
};
