-- Add thinking_tokens column and fix cost columns
-- Remove exact_cost (redundant with total_cost)
-- Add thinking_cost column
-- Ensure total_tokens = input_tokens + output_tokens + thinking_tokens
-- Ensure total_cost = input_cost + output_cost + thinking_cost

ALTER TABLE api_usage_logs
  -- Add thinking_tokens column (defaults to 0 for models without thinking like Flash)
  ADD COLUMN IF NOT EXISTS thinking_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Add thinking_cost column
  ADD COLUMN IF NOT EXISTS thinking_cost DECIMAL(12, 8) DEFAULT 0,
  
  -- Remove exact_cost column (redundant with total_cost)
  DROP COLUMN IF EXISTS exact_cost;

-- Add comment explaining the token structure
COMMENT ON COLUMN api_usage_logs.input_tokens IS 'Input/prompt tokens (from promptTokenCount)';
COMMENT ON COLUMN api_usage_logs.output_tokens IS 'Output/response tokens only (from candidatesTokenCount, excludes thinking)';
COMMENT ON COLUMN api_usage_logs.thinking_tokens IS 'Thinking tokens (from thinkingTokenCount, only for models with thinking like Gemini 2.5 Pro)';
COMMENT ON COLUMN api_usage_logs.total_tokens IS 'Total tokens = input_tokens + output_tokens + thinking_tokens';
COMMENT ON COLUMN api_usage_logs.thinking_cost IS 'Cost for thinking tokens (same rate as input tokens)';
COMMENT ON COLUMN api_usage_logs.total_cost IS 'Total cost = input_cost + output_cost + thinking_cost';







