/**
 * Admin authentication middleware.
 * Checks the Authorization header against the ADMIN_TOKEN environment variable.
 * Returns 401 Unauthorized if the token is missing or invalid.
 */
export function adminAuth(req, res, next) {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Support both "Bearer <token>" and raw token formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}
