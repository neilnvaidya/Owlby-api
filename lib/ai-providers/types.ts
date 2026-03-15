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

/**
 * Unified request params used by both Gemini and OpenAI-compatible helpers.
 * Handler builds this once per attempt; helpers receive it via execute().
 */
export interface UnifiedRequestParams {
  systemInstruction: string;
  contents: any[];
  responseSchema: any;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
}

/**
 * Helper interface so we "pull the correct helper" by model id and call execute().
 */
export type AIHelper = {
  execute(modelId: string, params: UnifiedRequestParams): Promise<AIAdapterResult>;
};
