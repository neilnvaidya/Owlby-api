import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';
import { UserProfile } from './profile.types';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';
const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err || !key) return callback(err || new Error('Signing key not found'));
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  jwt.verify(
    token,
    getKey,
    {
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    },
    (err, decoded: any) => {
      if (err || !decoded) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      // For MVP, just return Auth0 info from JWT
      const profile: UserProfile = {
        user_id: decoded.sub,
        name: decoded.name || '',
        email: decoded.email || '',
        picture: decoded.picture || undefined,
      };
      // Future: Lookup user in Supabase by auth_id (decoded.sub) and merge info
      return res.status(200).json(profile);
    }
  );
} 