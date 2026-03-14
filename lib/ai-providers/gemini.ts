import { ai, buildAIConfig } from '../ai-config';
import type { AIAdapterResult, AIHelper, NormalizedUsage, UnifiedRequestParams } from './types';

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
  const response = await withTimeout(
    ai.models.generateContent({
      model: modelName,
      config,
      contents,
    }),
    timeoutMs,
    'AI_REQUEST_TIMEOUT'
  );

  const responseText =
    response.text ||
    (Array.isArray((response as any).candidates) && (response as any).candidates.length > 0
      ? (response as any).candidates[0].content?.parts?.map((p: any) => p.text).join('') || ''
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

/**
 * Unified entry: build Gemini config from params and execute.
 * Used by executeRequest() when the model is a Gemini model.
 */
export async function executeGeminiRequest(
  modelId: string,
  params: UnifiedRequestParams
): Promise<AIAdapterResult> {
  const config = buildAIConfig(
    modelId,
    params.responseSchema,
    params.systemInstruction,
    params.maxOutputTokens,
    params.temperature
  );
  return executeGemini(modelId, config, params.contents, params.timeoutMs);
}

export const geminiHelper: AIHelper = { execute: executeGeminiRequest };
