-- Kalix Dear Diary - Initial Schema Setup
-- This script runs automatically when the Postgres container starts

-- Create schema
CREATE SCHEMA IF NOT EXISTS dear_diary;
SET search_path TO dear_diary, public;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
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

CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON dear_diary.users(telegram_user_id) WHERE telegram_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON dear_diary.users(email) WHERE email IS NOT NULL;

-- Todos table
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
    local_date DATE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON dear_diary.todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_user_status ON dear_diary.todos(user_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_user_local_date ON dear_diary.todos(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_todos_user_completed_at ON dear_diary.todos(user_id, completed_at DESC) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_due_date ON dear_diary.todos(user_id, due_date) WHERE due_date IS NOT NULL;

-- Diary entries table
CREATE TABLE IF NOT EXISTS dear_diary.diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    local_date DATE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diary_user_id ON dear_diary.diary_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_user_local_date ON dear_diary.diary_entries(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_diary_user_created_at ON dear_diary.diary_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_fts ON dear_diary.diary_entries USING gin(to_tsvector('english', raw_text));

-- Mood logs table
CREATE TABLE IF NOT EXISTS dear_diary.mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    note TEXT,
    local_date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'telegram' CHECK (source IN ('telegram', 'web', 'api')),
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_user_id ON dear_diary.mood_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_user_local_date ON dear_diary.mood_logs(user_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_mood_user_created_at ON dear_diary.mood_logs(user_id, created_at DESC);

-- Login codes table
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

-- Refresh tokens table
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

-- Helper functions
CREATE OR REPLACE FUNCTION dear_diary.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- Triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON dear_diary.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON dear_diary.users
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

DROP TRIGGER IF EXISTS update_todos_updated_at ON dear_diary.todos;
CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON dear_diary.todos
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

DROP TRIGGER IF EXISTS update_diary_updated_at ON dear_diary.diary_entries;
CREATE TRIGGER update_diary_updated_at
    BEFORE UPDATE ON dear_diary.diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();

DROP TRIGGER IF EXISTS calculate_diary_word_count ON dear_diary.diary_entries;
CREATE TRIGGER calculate_diary_word_count
    BEFORE INSERT OR UPDATE OF raw_text ON dear_diary.diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.calculate_word_count();

-- Done
SELECT 'Schema created successfully' as status;
