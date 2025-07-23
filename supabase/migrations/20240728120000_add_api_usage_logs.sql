-- Create the table for API usage logs
CREATE TABLE
  api_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    route TEXT NOT NULL CHECK (route IN ('chat', 'lesson', 'story')),
    user_id TEXT,
    chat_id TEXT,
    grade_level INTEGER NOT NULL DEFAULT 3,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    input_length INTEGER NOT NULL,
    output_length INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT false,
    error_type TEXT,
    exact_cost DECIMAL(12, 8) DEFAULT 0
  );

-- Optional: Add indexes for faster querying
CREATE INDEX idx_api_usage_logs_timestamp ON api_usage_logs (timestamp);

CREATE INDEX idx_api_usage_logs_route ON api_usage_logs (route);

CREATE INDEX idx_api_usage_logs_user_id ON api_usage_logs (user_id); 