import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';

// JWKS client to fetch signing keys
const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
});

// Helper function to get signing key
function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, function (err, key) {
    if (err || !key) return callback(err || new Error('Signing key not found'));
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Verify the JWT token and extract user info
export function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: AUTH0_AUDIENCE,
        issuer: `https://${AUTH0_DOMAIN}/`,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err || !decoded) {
          return reject(err || new Error('Invalid token'));
        }
        resolve(decoded);
      }
    );
  });
} 