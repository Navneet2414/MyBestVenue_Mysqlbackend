'use strict';

const jwt = require('jsonwebtoken');

const extractToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return tokenFromHeader || req.headers['x-access-token'] || req.query.token || '';
};

const verifyRole = (expectedRole) => (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ message: `${expectedRole[0].toUpperCase()}${expectedRole.slice(1)} token is required` });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || String(decoded.role || '').toLowerCase() !== expectedRole) {
      return res.status(403).json({ message: `${expectedRole[0].toUpperCase()}${expectedRole.slice(1)} access only` });
    }

    req.auth = decoded;
    return next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: `Invalid or expired ${expectedRole} token`, error: error.message || String(error) });
  }
};

const adminAuth = verifyRole('admin');
const venueAuth = verifyRole('venue');

module.exports = {
  adminAuth,
  venueAuth,
};
