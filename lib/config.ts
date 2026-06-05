/**
 * Owlby API config — all consts you may want to change are at the top.
 * Gemini-only; no other AI providers.
 */

// -----------------------------------------------------------------------------
// Gemini models (used by chat, lesson, story)
// -----------------------------------------------------------------------------
export const MODELS = {
  FLASH_LITE_PREVIEW: 'gemini-3.1-flash-lite-preview',
  FLASH_PREVIEW: 'gemini-3-flash-preview',
  FLASH: 'gemini-3-flash-preview',
  FLASH_OLD: 'gemini-2.5-flash',
  PRO: 'gemini-2.5-pro',
} as const;

// -----------------------------------------------------------------------------
// Route model config: primary + fallback chain per endpoint
// -----------------------------------------------------------------------------
export const ROUTE_MODEL_CONFIG: Record<string, {
  primary: string;
  fallback1: string;
  fallback2: string;
}> = {
  chat: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  lesson: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  story: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  /** Lesson v3 — one config entry per route (same chain as legacy lesson) */
  lesson_start: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  lesson_objectives: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  lesson_chunk: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  lesson_evaluate: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
  lesson_consolidation: {
    primary: MODELS.FLASH_LITE_PREVIEW,
    fallback1: MODELS.FLASH_PREVIEW,
    fallback2: MODELS.FLASH_OLD,
  },
};

// -----------------------------------------------------------------------------
// Route temperatures (Gemini 3 models ignore these and use 1.0)
// -----------------------------------------------------------------------------
export const ROUTE_TEMPERATURES: Record<string, number> = {
  chat: 0.75,
  lesson: 0.9,
  story: 0.9,
  lesson_start: 0.85,
  lesson_objectives: 0.85,
  lesson_chunk: 0.8,
  lesson_evaluate: 0.7,
  lesson_consolidation: 0.8,
};

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// -----------------------------------------------------------------------------
// AI request timeouts and retry (env overrides via process.env if needed)
// -----------------------------------------------------------------------------
export const AI_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 60000);
export const AI_TOTAL_BUDGET_MS = Number(process.env.AI_TOTAL_BUDGET_MS ?? 70000);
export const AI_PRIMARY_ATTEMPTS = Number(process.env.AI_PRIMARY_ATTEMPTS ?? 1);
export const AI_RETRY_BACKOFF_MS = Number(process.env.AI_RETRY_BACKOFF_MS ?? 250);
export const ENABLE_TIMING_LOGS = process.env.ENABLE_TIMING_LOGS !== 'false';
