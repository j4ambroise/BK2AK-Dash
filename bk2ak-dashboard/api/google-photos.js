/**
 * POST /api/google-photos
 * Proxies Google Photos mediaItems:search to avoid CORS restrictions.
 * Body: { albumId, pageToken? }
 * Requires Authorization: Bearer <google_access_token> header.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Google access token' });
  }
  const token = authHeader.slice(7);

  try {
    const { albumId, pageToken } = req.body || {};
    if (!albumId) return res.status(400).json({ error: 'albumId is required' });

    const body = { albumId, pageSize: 100 };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Google API error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
