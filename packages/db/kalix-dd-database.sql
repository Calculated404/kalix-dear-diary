-- Kalix Dear Diary - Database Schema
-- Schema: dear_diary
-- All timestamps: TIMESTAMPTZ
-- All "local day" fields: DATE computed using user timezone

-- Create schema
CREATE SCHEMA IF NOT EXISTS dear_diary;
SET search_path TO dear_diary, public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_user_id BIGINT UNIQUE,
    username VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(255),
    timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/Berlin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT chk_has_auth CHECK (
        telegram_user_id IS NOT NULL OR 
        (email IS NOT NULL AND password_hash IS NOT NULL)
    )
);

-- Index for telegram lookup (used by n8n integration)
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON dear_diary.users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON dear_diary.users(email) WHERE email IS NOT NULL;

-- ============================================
-- TODOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
    priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    due_date DATE,
    due_time TIME,
    completed_at TIMESTAMPTZ,
    local_date DATE NOT NULL, -- The date in user's timezone when created
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for todos
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON dear_diary.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_status ON dear_diary.todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_user_local_date ON dear_diary.todos(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_todos_user_completed_at ON dear_diary.todos(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date ON dear_diary.todos(user_id, due_date) WHERE due_date IS NOT NULL;

-- ============================================
-- DIARY ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    local_date DATE NOT NULL, -- The date in user's timezone
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for diary entries
CREATE INDEX IF NOT EXISTS idx_diary_user_id ON dear_diary.diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_user_local_date ON dear_diary.diary_entries(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_user_created_at ON dear_diary.diary_entries(user_id, created_at DESC);

-- Full-text search index for diary content
CREATE INDEX IF NOT EXISTS idx_diary_fts ON dear_diary.diary_entries USING gin(to_tsvector('english', raw_text));

-- ============================================
-- MOOD LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    note TEXT,
    local_date DATE NOT NULL, -- The date in user's timezone
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for mood logs
CREATE INDEX IF NOT EXISTS idx_mood_user_id ON dear_diary.mood_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_user_local_date ON dear_diary.mood_logs(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_mood_user_created_at ON dear_diary.mood_logs(user_id, created_at DESC);

-- ============================================
-- LOGIN CODES TABLE (for Telegram-based auth)
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.login_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_code ON dear_diary.login_codes(code) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_login_codes_user_id ON dear_diary.login_codes(user_id);

-- ============================================
-- REFRESH TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dear_diary.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON dear_diary.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON dear_diary.refresh_tokens(token_hash) WHERE revoked_at IS NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION dear_diary.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to calculate word count
CREATE OR REPLACE FUNCTION dear_diary.calculate_word_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = array_length(string_to_array(trim(NEW.raw_text), ' '), 1);
    IF NEW.word_count IS NULL THEN
        NEW.word_count = 0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to compute local_date from timestamp and user timezone
CREATE OR REPLACE FUNCTION dear_diary.compute_local_date(ts TIMESTAMPTZ, tz VARCHAR)
RETURNS DATE AS $$
BEGIN
    RETURN (ts AT TIME ZONE tz)::DATE;
END;
$$ language 'plpgsql' IMMUTABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON dear_diary.users
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON dear_diary.todos
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_diary_updated_at
    BEFORE UPDATE ON dear_diary.diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

-- Auto-calculate word count for diary entries
CREATE OR REPLACE TRIGGER calculate_diary_word_count
    BEFORE INSERT OR UPDATE OF raw_text ON dear_diary.diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.calculate_word_count();

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Daily stats view (used for dashboard)
CREATE OR REPLACE VIEW dear_diary.daily_stats AS
SELECT
    u.id AS user_id,
    d.date AS local_date,
    COALESCE(t.todos_created, 0) AS todos_created,
    COALESCE(t.todos_completed, 0) AS todos_completed,
    COALESCE(de.diary_count, 0) AS diary_count,
    COALESCE(de.word_count, 0) AS word_count,
    m.avg_mood,
    COALESCE(m.mood_count, 0) AS mood_count
FROM dear_diary.users u
CROSS JOIN generate_series(
    CURRENT_DATE - INTERVAL '365 days',
    CURRENT_DATE,
    '1 day'::interval
) AS d(date)
LEFT JOIN (
    SELECT 
        user_id,
        local_date,
        COUNT(*) AS todos_created,
        COUNT(*) FILTER (WHERE status = 'done') AS todos_completed
    FROM dear_diary.todos
    GROUP BY user_id, local_date
) t ON u.id = t.user_id AND d.date = t.local_date
LEFT JOIN (
    SELECT 
        user_id,
        local_date,
        COUNT(*) AS diary_count,
        SUM(word_count) AS word_count
    FROM dear_diary.diary_entries
    GROUP BY user_id, local_date
) de ON u.id = de.user_id AND d.date = de.local_date
LEFT JOIN (
    SELECT 
        user_id,
        local_date,
        AVG(mood_score)::NUMERIC(3,2) AS avg_mood,
        COUNT(*) AS mood_count
    FROM dear_diary.mood_logs
    GROUP BY user_id, local_date
) m ON u.id = m.user_id AND d.date = m.local_date;

-- Comment: This schema is the source of truth.
-- Any changes must be documented in docs/db.md as migration diffs.
