/**
 * Shared async helpers used across the API lib.
 * Centralized here to avoid the copy-pasted `withTimeout`/`sleep` that previously
 * lived in api-handler, api-logger, auth-supabase, gemini, subscription-gate, and lesson-v3-ai.
 */

/**
 * Reject `promise` with `Error(timeoutMessage)` if it has not settled within `timeoutMs`.
 * The timer is always cleared so it never keeps the event loop alive.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'TIMEOUT',
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(timeoutId));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
