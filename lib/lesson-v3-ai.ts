/**
 * Lesson v3 AI wrapper — Part 9.3: up to 2 retries (3 attempts) on parse/validation failure.
 */

import { processAIRequest } from './api-handler.js';
import { AI_RETRY_BACKOFF_MS } from './config.js';
import { sleep } from './async-utils.js';

export interface LessonV3AIResult {
  responseText: string;
  usageMetadata: any;
  modelUsed: string;
  fallbackUsed: boolean;
}

/**
 * Calls processAIRequest; parses JSON and runs parseAndValidate.
 * On failure, retries up to 2 additional times (3 total attempts).
 */
export async function runLessonV3WithSchemaRetries<T>(
  endpoint: string,
  responseSchema: any,
  systemInstruction: string,
  contents: any[],
  inputText: string,
  parseAndValidate: (responseText: string) => T,
  maxOutputTokens: number = 4096,
): Promise<{ data: T } & LessonV3AIResult> {
  let lastError: Error = new Error('LESSON_V3_GENERATION_FAILED');
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await processAIRequest(
        responseSchema,
        systemInstruction,
        contents,
        endpoint,
        inputText,
        maxOutputTokens,
      );
      let parsed: T;
      try {
        parsed = parseAndValidate(result.responseText);
      } catch (validationErr: any) {
        lastError = new Error(validationErr?.message || 'Schema validation failed');
        if (attempt < maxAttempts) {
          await sleep(AI_RETRY_BACKOFF_MS * attempt);
        }
        continue;
      }
      return { data: parsed, ...result };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        await sleep(AI_RETRY_BACKOFF_MS * attempt);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}
