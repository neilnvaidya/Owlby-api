import { ai } from '../ai-config.js';
import type { AIAdapterResult, NormalizedUsage } from './types.js';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(timeoutId));
}

function normalizeGeminiUsage(usageMetadata: any): NormalizedUsage {
  const promptTokenCount = usageMetadata?.promptTokenCount ?? 0;
  const candidatesTokenCount = usageMetadata?.candidatesTokenCount ?? 0;
  const thinkingTokenCount =
    usageMetadata?.thinkingTokenCount ?? (usageMetadata as any)?.thoughtsTokenCount ?? 0;
  const totalTokenCount =
    usageMetadata?.totalTokenCount ?? promptTokenCount + candidatesTokenCount + thinkingTokenCount;
  return {
    promptTokenCount,
    candidatesTokenCount,
    ...(thinkingTokenCount > 0 && { thinkingTokenCount }),
    totalTokenCount,
  };
}

/**
 * Execute a request using the Gemini (Google GenAI) API.
 * Returns normalized responseText and usageMetadata for use by api-handler and loggers.
 */
export async function executeGemini(
  modelName: string,
  config: any,
  contents: any[],
  timeoutMs: number
): Promise<AIAdapterResult> {
  const raw = await withTimeout(
    ai.models.generateContent({
      model: modelName,
      config,
      contents,
    }),
    timeoutMs,
    'AI_REQUEST_TIMEOUT'
  );
  const response = raw as { text?: string; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: any };

  const responseText =
    response.text ||
    (Array.isArray(response.candidates) && response.candidates.length > 0
      ? response.candidates[0].content?.parts?.map((p) => p.text).join('') || ''
      : '');

  if (!responseText) {
    throw new Error('Empty response from AI service');
  }

  const usageMetadata = normalizeGeminiUsage(response.usageMetadata);
  return {
    responseText,
    usageMetadata,
  };
}
