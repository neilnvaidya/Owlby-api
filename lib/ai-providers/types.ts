/**
 * Types for the Gemini adapter (only provider).
 */

export interface NormalizedUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thinkingTokenCount?: number;
  totalTokenCount: number;
}

export interface AIAdapterResult {
  responseText: string;
  usageMetadata: NormalizedUsage;
}
