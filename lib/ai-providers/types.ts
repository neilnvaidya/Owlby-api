/**
 * Normalized usage metadata returned by all AI providers.
 * Adapters (Gemini, OpenAI-compatible) must map their native usage to this shape
 * so api-logger and route loggers work without change.
 */
export interface NormalizedUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thinkingTokenCount?: number;
  totalTokenCount: number;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIAdapterResult {
  responseText: string;
  usageMetadata: NormalizedUsage;
}
