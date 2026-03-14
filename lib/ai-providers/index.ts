import { getHelper } from './resolve';
import type { AIAdapterResult, UnifiedRequestParams } from './types';

export type { AIAdapterResult, AIHelper, NormalizedUsage, UnifiedRequestParams } from './types';
export { getHelper, getProviderForModel } from './resolve';
export { geminiHelper } from './gemini';
export { openaiHelper } from './openai';

/**
 * Single entry point: resolve the helper for the model and execute.
 * Handler calls this only; no direct use of executeGemini or executeOpenAI.
 */
export async function executeRequest(
  modelId: string,
  params: UnifiedRequestParams
): Promise<AIAdapterResult> {
  const helper = getHelper(modelId);
  return helper.execute(modelId, params);
}
