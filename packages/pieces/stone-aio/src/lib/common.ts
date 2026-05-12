import { PieceAuth } from '@activepieces/pieces-framework';

export const stoneAIOAuth = PieceAuth.SecretText({
  displayName: 'Stone AIO API Key',
  required: true,
  description: 'Your Stone AIO workspace API key. Find it in Settings → API Keys.',
});

export const STONE_AIO_BASE_URL = process.env['STONE_AIO_BASE_URL'] ?? 'http://localhost:4000';

export async function callStoneAIOAPI(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
) {
  const response = await fetch(`${STONE_AIO_BASE_URL}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stone AIO API error ${response.status}: ${error}`);
  }

  return response.json();
}
