import { Type } from '@google/genai';

/**
 * JSON Schema shape for OpenAI response_format.json_schema.schema.
 * Supports type, properties, required, items, enum, description.
 */
export interface JsonSchemaObject {
  type: string;
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  items?: JsonSchemaObject;
  enum?: string[];
  description?: string;
}

type GeminiSchemaNode = {
  type: unknown;
  properties?: Record<string, GeminiSchemaNode>;
  required?: string[];
  items?: GeminiSchemaNode;
  enum?: readonly string[] | string[];
  description?: string;
};

const GEMINI_TYPE_TO_JSON: Record<string, string> = {
  [Type.STRING]: 'string',
  [Type.NUMBER]: 'number',
  [Type.INTEGER]: 'integer',
  [Type.BOOLEAN]: 'boolean',
  [Type.ARRAY]: 'array',
  [Type.OBJECT]: 'object',
  [Type.NULL]: 'null',
  TYPE_UNSPECIFIED: 'string',
};

/**
 * Convert a Gemini (Google GenAI) response schema to JSON Schema
 * for use with OpenAI-compatible response_format.
 */
export function geminiSchemaToJsonSchema(schema: GeminiSchemaNode): JsonSchemaObject {
  const t = (schema.type as string) || 'STRING';
  const jsonType = GEMINI_TYPE_TO_JSON[t] ?? 'string';

  const out: JsonSchemaObject = {
    type: jsonType,
  };

  if (schema.description) {
    out.description = schema.description;
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    out.enum = [...schema.enum];
  }

  if (jsonType === 'object' && schema.properties && typeof schema.properties === 'object') {
    const properties: Record<string, JsonSchemaObject> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = geminiSchemaToJsonSchema(value as GeminiSchemaNode);
    }
    out.properties = properties;
    if (schema.required && Array.isArray(schema.required)) {
      out.required = [...schema.required];
    }
  }

  if (jsonType === 'array' && schema.items) {
    out.items = geminiSchemaToJsonSchema(schema.items as GeminiSchemaNode);
  }

  return out;
}
