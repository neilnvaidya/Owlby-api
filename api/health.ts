export default function handler(req: any, res: any) {
  // Log health check requests to Vercel logs
  const timestamp = new Date().toISOString();
  const method = req.method || 'GET';
  const url = req.url || '/health';
  const userAgent = req.headers?.['user-agent'] || 'unknown';
  const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || 'unknown';
  
  console.info(`[HEALTH] ${timestamp} - ${method} ${url}`, {
    method,
    url,
    userAgent,
    ip,
    headers: {
      'x-forwarded-for': req.headers?.['x-forwarded-for'],
      'x-real-ip': req.headers?.['x-real-ip'],
      'user-agent': userAgent,
    }
  });
  
  res.status(200).json({ 
    status: 'ok',
    timestamp,
    service: 'owlby-api',
    version: '1.0.0'
  });
} 