import axios from 'axios';

function formatToE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('44')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+44${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `+44${cleaned}`;
  return `+${cleaned}`;
}

export async function sendSMS(to: string, body: string) {
  const accessKey = process.env.BIRD_ACCESS_KEY;
  const workspaceId = process.env.BIRD_WORKSPACE_ID;
  const channelId = process.env.BIRD_CHANNEL_ID;

  if (!accessKey || !workspaceId || !channelId) {
    throw new Error('Bird SMS credentials are missing');
  }

  const e164 = formatToE164(to);

  try {
    const response = await axios.post(
      `https://api.bird.com/workspaces/${workspaceId}/channels/${channelId}/messages`,
      {
        receiver: {
          contacts: [{ identifierKey: 'phonenumber', identifierValue: e164 }],
        },
        body: { type: 'text', text: { text: body } },
      },
      {
        headers: {
          Authorization: `AccessKey ${accessKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const message = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`Bird SMS error (${status}): ${message}`);
  }
}
