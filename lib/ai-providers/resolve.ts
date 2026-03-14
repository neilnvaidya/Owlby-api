import { MODEL_PROVIDER } from '../ai-config';
import { geminiHelper } from './gemini';
import { openaiHelper } from './openai';
import type { AIHelper, AIProvider } from './types';

export type { AIHelper } from './types';

/**
 * Resolve which provider to use for a given model id.
 * Reads from MODEL_PROVIDER; optional env OPENAI_COMPATIBLE_MODELS (comma-separated)
 * can add model ids that use 'openai' without code change.
 * Unknown models default to 'gemini' so current behavior is unchanged.
 */
export function getProviderForModel(modelId: string): AIProvider {
  const fromConfig = MODEL_PROVIDER[modelId];
  if (fromConfig) return fromConfig;

  const envList = process.env.OPENAI_COMPATIBLE_MODELS;
  if (envList) {
    const ids = envList.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.includes(modelId)) return 'openai';
  }

  return 'gemini';
}

/**
 * Return the correct helper for the given model id.
 * Used by executeRequest() to pull the right adapter.
 */
export function getHelper(modelId: string): AIHelper {
  return getProviderForModel(modelId) === 'openai' ? openaiHelper : geminiHelper;
}
