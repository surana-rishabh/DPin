import { getAuth } from '@clerk/express';
import jwt from 'jsonwebtoken';
import { Validator } from './model/model.js';

const readCookie = (req, name) => {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name);
  return cookie ? decodeURIComponent(cookie.slice(1).join('=')) : null;
};

export const authenticateUser = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.authenticatedUserId = auth.userId;
  return next();
};

export const authenticateValidator = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(503).json({ message: 'Validator authentication is not configured' });

    const bearer = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
    const token = bearer || readCookie(req, 'validator_token');
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'dpin-api',
      audience: 'dpin-validator',
    });
    const validator = await Validator.findById(decoded.sub);
    if (!validator) return res.status(401).json({ message: 'Validator not found' });

    req.user = validator;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
};
