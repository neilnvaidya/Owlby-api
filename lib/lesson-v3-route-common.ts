import { handleCORS } from './api-handler.js';
import { verifySupabaseToken } from './auth-supabase.js';
import { checkRateLimit } from './rate-limit.js';
import { canGenerate } from './subscription-gate.js';
import { isValidStudentAge } from './lesson-age.js';

export function jsonBadRequest(res: any, userMessage: string, error = 'BadRequest') {
  return res.status(400).json({
    success: false,
    error,
    userMessage,
  });
}

export function jsonGenerationError(res: any, userMessage: string) {
  return res.status(500).json({
    success: false,
    error: 'GenerationFailed',
    userMessage,
  });
}

export interface LessonV3AuthContext {
  userId: string;
  token: string;
}

/**
 * CORS + POST + Bearer auth + subscription gate for lesson route.
 * rateLimitKey example: lesson_v3_start:${userId}
 */
export async function lessonV3Prelude(
  req: any,
  res: any,
  opts: { rateLimitKey: string; rateLimitMax: number; rateWindowMs: number },
): Promise<LessonV3AuthContext | null> {
  if (!handleCORS(req, res)) return null;

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Missing authorization token',
      userMessage: 'Please sign in again.',
    });
    return null;
  }

  let decoded: any;
  try {
    decoded = await verifySupabaseToken(token);
  } catch {
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      userMessage: 'Session expired. Please sign in again.',
    });
    return null;
  }

  const userId = decoded?.id || 'unknown';

  const gate = await canGenerate(userId, 'lesson');
  if (!gate.allowed) {
    res.status(403).json({
      success: false,
      code: gate.reason,
      userMessage:
        gate.reason === 'daily_limit_reached'
          ? "You've reached your daily limit. Upgrade for unlimited access."
          : 'A subscription is required for this feature.',
    });
    return null;
  }

  const rate = checkRateLimit(opts.rateLimitKey, opts.rateLimitMax, opts.rateWindowMs);
  if (!rate.allowed) {
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      userMessage: "Slow down for a moment — try again shortly.",
      retryAfterMs: rate.retryAfterMs,
    });
    return null;
  }

  return { userId, token };
}

export function validateStudentAgeField(age: unknown): age is number {
  return typeof age === 'number' && isValidStudentAge(age);
}
