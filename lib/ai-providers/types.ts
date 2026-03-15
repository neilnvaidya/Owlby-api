/**
 * Normalized usage metadata returned by the Gemini adapter.
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
