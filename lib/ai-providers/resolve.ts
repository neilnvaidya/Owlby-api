import type { AIProvider } from './types';

/**
 * Resolve which provider to use for a given model id.
 * Project is 100% Gemini: all routes (chat, lesson, story) use only Gemini models.
 */
export function getProviderForModel(_modelId: string): AIProvider {
  return 'gemini';
}
