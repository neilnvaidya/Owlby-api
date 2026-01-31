export default function handler(req: any, res: any) {
  // Log health check requests to Vercel logs
  // Using console.log for better Vercel visibility
  const timestamp = new Date().toISOString();
  const method = req.method || 'GET';
  const url = req.url || '/health';
  const userAgent = req.headers?.['user-agent'] || 'unknown';
  const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  
  // Multiple log formats for maximum visibility in Vercel
  console.log(`[HEALTH CHECK] ${timestamp} - ${method} ${url}`);
  console.log(`[HEALTH] IP: ${ip} | User-Agent: ${userAgent}`);
  console.log('[HEALTH] Request details:', JSON.stringify({
    timestamp,
    method,
    url,
    userAgent,
    ip,
    headers: {
      'x-forwarded-for': req.headers?.['x-forwarded-for'],
      'x-real-ip': req.headers?.['x-real-ip'],
      'user-agent': userAgent,
      'host': req.headers?.host,
    }
  }, null, 2));
  
  res.status(200).json({ 
    status: 'ok',
    timestamp,
    service: 'owlby-api',
    version: '1.0.0'
  });
} 