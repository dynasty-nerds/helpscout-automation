-- AI Response Generation Database Schema
-- PostgreSQL with vector extension for embeddings

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Track processed threads to avoid duplicates
CREATE TABLE processed_threads (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    thread_id INTEGER NOT NULL,
    thread_type VARCHAR(50) NOT NULL, -- 'customer', 'note', 'reply'
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_result JSONB, -- Store any processing metadata
    UNIQUE(conversation_id, thread_id)
);

-- Create indexes for performance
CREATE INDEX idx_processed_threads_conversation ON processed_threads(conversation_id);
CREATE INDEX idx_processed_threads_processed_at ON processed_threads(processed_at);

-- Store HelpScout documentation cache
CREATE TABLE documentation_cache (
    id SERIAL PRIMARY KEY,
    article_id VARCHAR(100) UNIQUE NOT NULL,
    collection_id VARCHAR(100),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    url TEXT,
    category VARCHAR(200),
    tags TEXT[],
    last_updated TIMESTAMP,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding vector(1536), -- OpenAI ada-002 embedding size
    word_count INTEGER,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for documentation search
CREATE INDEX idx_docs_article_id ON documentation_cache(article_id);
CREATE INDEX idx_docs_collection ON documentation_cache(collection_id);
CREATE INDEX idx_docs_category ON documentation_cache(category);
CREATE INDEX idx_docs_active ON documentation_cache(is_active);
-- Vector similarity search index
CREATE INDEX idx_docs_embedding ON documentation_cache USING ivfflat (embedding vector_cosine_ops);

-- Store AI-generated response suggestions
CREATE TABLE response_suggestions (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    thread_id INTEGER NOT NULL,
    customer_message TEXT NOT NULL,
    suggested_response TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    reasoning TEXT,
    referenced_docs TEXT[], -- Array of article_ids
    response_type VARCHAR(50), -- 'billing', 'technical', 'account', 'general'
    model_used VARCHAR(50) DEFAULT 'claude-3.5-sonnet',
    tokens_used INTEGER,
    cost_cents INTEGER, -- Cost in cents
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for suggestions
CREATE INDEX idx_suggestions_conversation ON response_suggestions(conversation_id);
CREATE INDEX idx_suggestions_created_at ON response_suggestions(created_at);
CREATE INDEX idx_suggestions_type ON response_suggestions(response_type);
CREATE INDEX idx_suggestions_confidence ON response_suggestions(confidence_score);

-- Track actual agent responses and modifications
CREATE TABLE agent_responses (
    id SERIAL PRIMARY KEY,
    suggestion_id INTEGER REFERENCES response_suggestions(id) ON DELETE CASCADE,
    conversation_id INTEGER NOT NULL,
    thread_id INTEGER NOT NULL,
    actual_response TEXT NOT NULL,
    agent_id INTEGER, -- HelpScout user ID
    agent_email VARCHAR(255),
    modifications TEXT, -- Description of changes made
    modification_type VARCHAR(50), -- 'minor', 'major', 'complete_rewrite', 'no_change'
    feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
    feedback_notes TEXT,
    response_time_minutes INTEGER, -- How long agent took to respond
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for agent responses
CREATE INDEX idx_agent_responses_suggestion ON agent_responses(suggestion_id);
CREATE INDEX idx_agent_responses_conversation ON agent_responses(conversation_id);
CREATE INDEX idx_agent_responses_agent ON agent_responses(agent_id);
CREATE INDEX idx_agent_responses_type ON agent_responses(modification_type);
CREATE INDEX idx_agent_responses_score ON agent_responses(feedback_score);

-- Track documentation gaps and suggestions
CREATE TABLE documentation_gaps (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER,
    thread_id INTEGER,
    suggested_topic TEXT NOT NULL,
    gap_description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high'
    frequency_count INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_progress', 'completed', 'dismissed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for documentation gaps
CREATE INDEX idx_gaps_status ON documentation_gaps(status);
CREATE INDEX idx_gaps_priority ON documentation_gaps(priority);
CREATE INDEX idx_gaps_frequency ON documentation_gaps(frequency_count);

-- Track system performance and costs
CREATE TABLE system_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE DEFAULT CURRENT_DATE,
    total_tickets_processed INTEGER DEFAULT 0,
    suggestions_generated INTEGER DEFAULT 0,
    suggestions_accepted INTEGER DEFAULT 0,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    avg_confidence_score DECIMAL(3,2),
    avg_response_time_minutes DECIMAL(5,2),
    documentation_articles_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date)
);

-- Create index for metrics
CREATE INDEX idx_metrics_date ON system_metrics(metric_date);

-- Create a view for easy reporting
CREATE VIEW suggestion_analytics AS
SELECT 
    DATE(rs.created_at) as date,
    COUNT(*) as total_suggestions,
    COUNT(ar.id) as responses_tracked,
    AVG(rs.confidence_score) as avg_confidence,
    AVG(CASE WHEN ar.modification_type = 'no_change' THEN 1 ELSE 0 END) as acceptance_rate,
    SUM(rs.tokens_used) as total_tokens,
    SUM(rs.cost_cents) as total_cost_cents,
    COUNT(DISTINCT rs.conversation_id) as unique_conversations
FROM response_suggestions rs
LEFT JOIN agent_responses ar ON rs.id = ar.suggestion_id
WHERE rs.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(rs.created_at)
ORDER BY date DESC;

-- Function to update metrics daily
CREATE OR REPLACE FUNCTION update_daily_metrics()
RETURNS void AS $$
BEGIN
    INSERT INTO system_metrics (
        metric_date,
        total_tickets_processed,
        suggestions_generated,
        suggestions_accepted,
        total_tokens_used,
        total_cost_cents,
        avg_confidence_score,
        avg_response_time_minutes,
        documentation_articles_count
    )
    SELECT 
        CURRENT_DATE,
        (SELECT COUNT(*) FROM processed_threads WHERE DATE(processed_at) = CURRENT_DATE),
        (SELECT COUNT(*) FROM response_suggestions WHERE DATE(created_at) = CURRENT_DATE),
        (SELECT COUNT(*) FROM agent_responses WHERE DATE(created_at) = CURRENT_DATE AND modification_type = 'no_change'),
        (SELECT COALESCE(SUM(tokens_used), 0) FROM response_suggestions WHERE DATE(created_at) = CURRENT_DATE),
        (SELECT COALESCE(SUM(cost_cents), 0) FROM response_suggestions WHERE DATE(created_at) = CURRENT_DATE),
        (SELECT AVG(confidence_score) FROM response_suggestions WHERE DATE(created_at) = CURRENT_DATE),
        (SELECT AVG(response_time_minutes) FROM agent_responses WHERE DATE(created_at) = CURRENT_DATE),
        (SELECT COUNT(*) FROM documentation_cache WHERE is_active = true)
    ON CONFLICT (metric_date) DO UPDATE SET
        total_tickets_processed = EXCLUDED.total_tickets_processed,
        suggestions_generated = EXCLUDED.suggestions_generated,
        suggestions_accepted = EXCLUDED.suggestions_accepted,
        total_tokens_used = EXCLUDED.total_tokens_used,
        total_cost_cents = EXCLUDED.total_cost_cents,
        avg_confidence_score = EXCLUDED.avg_confidence_score,
        avg_response_time_minutes = EXCLUDED.avg_response_time_minutes,
        documentation_articles_count = EXCLUDED.documentation_articles_count;
END;
$$ LANGUAGE plpgsql;