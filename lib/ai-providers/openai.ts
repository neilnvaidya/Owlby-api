import { geminiSchemaToJsonSchema } from './schema-convert';
import type { AIAdapterResult, NormalizedUsage } from './types';

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(resolve).catch(reject);
  }).finally(() => clearTimeout(timeoutId));
}

/**
 * Build OpenAI-style messages from systemInstruction + Gemini-style contents.
 */
function buildMessages(systemInstruction: string, contents: any[]): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  for (const c of contents) {
    const role = c.role === 'user' ? 'user' : c.role === 'model' ? 'assistant' : 'user';
    const text = Array.isArray(c.parts)
      ? c.parts.map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('')
      : '';
    if (text) messages.push({ role, content: text });
  }
  return messages;
}

/**
 * Execute a request using an OpenAI-compatible API (OpenAI, DeepSeek, Azure, etc.).
 * Set OPENAI_API_KEY and optionally OPENAI_BASE_URL (e.g. for DeepSeek).
 * Returns normalized responseText and usageMetadata.
 */
export async function executeOpenAI(
  modelId: string,
  systemInstruction: string,
  contents: any[],
  responseSchema: any,
  maxOutputTokens: number,
  temperature: number,
  timeoutMs: number
): Promise<AIAdapterResult> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set; cannot use OpenAI-compatible provider');
  }

  const messages = buildMessages(systemInstruction, contents);
  const jsonSchema = geminiSchemaToJsonSchema(responseSchema);

  const body = {
    model: modelId,
    messages,
    max_tokens: maxOutputTokens,
    temperature,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'owlby_response',
        strict: true,
        schema: jsonSchema,
      },
    },
  };

  const url = OPENAI_BASE_URL.replace(/\/$/, '') + '/v1/chat/completions';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const response = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }),
    timeoutMs,
    'AI_REQUEST_TIMEOUT'
  ).finally(() => clearTimeout(timeoutId));

  if (!response.ok) {
    const errText = await response.text();
    let message = `OpenAI-compatible API error ${response.status}: ${errText}`;
    try {
      const errJson = JSON.parse(errText);
      message = errJson.error?.message || message;
    } catch {
      // use errText as message
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices?.[0]?.message?.content;
  if (content == null || content === '') {
    throw new Error('Empty response from AI service');
  }

  const usage = data.usage || {};
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const usageMetadata: NormalizedUsage = {
    promptTokenCount: promptTokens,
    candidatesTokenCount: completionTokens,
    totalTokenCount: usage.total_tokens ?? promptTokens + completionTokens,
  };

  return {
    responseText: content,
    usageMetadata,
  };
}
