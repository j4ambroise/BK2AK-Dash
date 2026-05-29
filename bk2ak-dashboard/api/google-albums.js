/**
 * GET /api/google-albums
 * Proxies Google Photos album list to avoid CORS restrictions.
 * Requires Authorization: Bearer <google_access_token> header.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Google access token' });
  }
  const token = authHeader.slice(7);

  try {
    const pageToken = req.query.pageToken || '';
    const url = `https://photoslibrary.googleapis.com/v1/albums?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ''}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
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
