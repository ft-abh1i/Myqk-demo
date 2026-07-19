module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = String(
    process.env.GOOGLE_MAPS_BROWSER_KEY
    || process.env.GOOGLE_MAPS_API_KEY
    || ''
  ).trim();

  res.status(200).json({
    enabled: Boolean(apiKey),
    apiKey
  });
};
