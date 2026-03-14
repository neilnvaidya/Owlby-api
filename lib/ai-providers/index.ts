import { getHelper } from './resolve';
import type { AIAdapterResult, UnifiedRequestParams } from './types';

export type { AIAdapterResult, AIHelper, NormalizedUsage, UnifiedRequestParams } from './types';
export { getHelper, getProviderForModel } from './resolve';
export { geminiHelper } from './gemini';
export { openaiHelper } from './openai';

const ENABLE_AI_DEBUG_LOGS = process.env.ENABLE_AI_DEBUG_LOGS === 'true';

/**
 * Single entry point: resolve the helper for the model and execute.
 * Handler calls this only; no direct use of executeGemini or executeOpenAI.
 * When ENABLE_AI_DEBUG_LOGS=true, logs full prompt and response (no truncation) for Vercel/debug.
 */
export async function executeRequest(
  modelId: string,
  params: UnifiedRequestParams
): Promise<AIAdapterResult> {
  if (ENABLE_AI_DEBUG_LOGS) {
    const promptPayload = {
      modelId,
      systemInstruction: params.systemInstruction,
      contents: params.contents,
    };
    console.log('[AI_DEBUG] REQUEST_PROMPT ' + JSON.stringify(promptPayload));
  }

  const helper = getHelper(modelId);
  const result = await helper.execute(modelId, params);

  if (ENABLE_AI_DEBUG_LOGS) {
    console.log('[AI_DEBUG] REQUEST_RESPONSE ' + result.responseText);
  }

  return result;
}
