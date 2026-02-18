import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_DOCS = ['privacy-policy', 'terms'] as const;
type DocSlug = (typeof ALLOWED_DOCS)[number];

function isDocSlug(doc: string | string[] | undefined): doc is DocSlug {
  return typeof doc === 'string' && ALLOWED_DOCS.includes(doc as DocSlug);
}

const DOC_TO_FILE: Record<DocSlug, string> = {
  'privacy-policy': 'privacy-policy.txt',
  terms: 'terms.txt',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).setHeader('Allow', 'GET').json({ error: 'Method not allowed' });
  }

  const doc = req.query?.doc;
  if (!isDocSlug(doc)) {
    return res.status(400).json({
      error: 'Invalid or missing document',
      allowed: ALLOWED_DOCS,
    });
  }

  try {
    const fileName = DOC_TO_FILE[doc];
    const filePath = join(process.cwd(), 'legal', fileName);
    const content = readFileSync(filePath, 'utf-8');
    return res.status(200).json({ content });
  } catch (err) {
    console.error('[legal] read error:', err);
    return res.status(500).json({ error: 'Failed to load document' });
  }
}
