# Database Documentation

## Overview

Kalix Dear Diary uses PostgreSQL with the `dear_diary` schema.

**Connection String Format:**
```
postgresql://kalix:kalix@host:5433/kalix_diary
```
(Default user/password: `kalix` / `kalix`. From host use port 5433 if using Docker.)

### Resetting the Docker database

If you change `POSTGRES_USER` or `POSTGRES_PASSWORD` in docker-compose or `.env`, the running Postgres container **does not** update: it was initialized with the credentials from the first run. To apply new credentials you must remove the volume and start fresh:

```bash
docker compose down
docker volume rm kalix-dear-diary_postgres_data
docker compose up -d postgres
# Wait a few seconds, then run migrations
pnpm db:migrate
pnpm db:seed
```

Then start the rest: `docker compose up -d`.

## Schema

### Users

```sql
CREATE SCHEMA IF NOT EXISTS dear_diary;


CREATE TABLE dear_diary.users (
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
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
```

**Key Points:**
- Users can authenticate via Telegram OR email/password
- `telegram_user_id` enables linking with Telegram accounts
- `timezone` is used for local date calculations

### Todos

```sql
CREATE TABLE dear_diary.todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority INTEGER DEFAULT 0,
    due_date DATE,
    due_time TIME,
    completed_at TIMESTAMPTZ,
    local_date DATE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram',
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Status Values:** `open`, `done`, `cancelled`
**Priority:** 0-3 (0=normal, 3=urgent)
**Source:** `telegram`, `web`, `api`

### Diary Entries

```sql
CREATE TABLE dear_diary.diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    raw_text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    local_date DATE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source VARCHAR(50) DEFAULT 'telegram',
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Note:** `word_count` is automatically calculated by a trigger.

### Mood Logs

```sql
CREATE TABLE dear_diary.mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
    note TEXT,
    local_date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'telegram',
    telegram_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Mood Scale:** 1-5 (1=very bad, 5=very good)

### Login Codes

```sql
CREATE TABLE dear_diary.login_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Used for Telegram-based authentication.

### Refresh Tokens

```sql
CREATE TABLE dear_diary.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES dear_diary.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);
```

## Indexes

Performance indexes are created for common query patterns:

```sql
-- User lookups
CREATE INDEX idx_users_telegram_user_id ON dear_diary.users(telegram_user_id);
CREATE INDEX idx_users_email ON dear_diary.users(email);

-- Todo queries
CREATE INDEX idx_todos_user_id ON dear_diary.todos(user_id);
CREATE INDEX idx_todos_user_status ON dear_diary.todos(user_id, status);
CREATE INDEX idx_todos_user_local_date ON dear_diary.todos(user_id, local_date DESC);
CREATE INDEX idx_todos_user_completed_at ON dear_diary.todos(user_id, completed_at DESC);

-- Diary queries
CREATE INDEX idx_diary_user_local_date ON dear_diary.diary_entries(user_id, local_date DESC);
CREATE INDEX idx_diary_fts ON dear_diary.diary_entries USING gin(to_tsvector('english', raw_text));

-- Mood queries
CREATE INDEX idx_mood_user_local_date ON dear_diary.mood_logs(user_id, local_date DESC);
```

## Triggers

### Auto-update timestamps

```sql
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON dear_diary.users
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.update_updated_at_column();
```

### Auto-calculate word count

```sql
CREATE TRIGGER calculate_diary_word_count
    BEFORE INSERT OR UPDATE OF raw_text ON dear_diary.diary_entries
    FOR EACH ROW
    EXECUTE FUNCTION dear_diary.calculate_word_count();
```

## User Isolation

**CRITICAL:** All queries MUST include `user_id` filter to prevent data leakage.

```sql
-- ✅ Correct
SELECT * FROM dear_diary.todos WHERE user_id = $1 AND id = $2;

-- ❌ WRONG - exposes other users' data
SELECT * FROM dear_diary.todos WHERE id = $1;
```

## Running Migrations

```bash
# Using npm scripts
pnpm db:migrate

# Manual
psql $DATABASE_URL < packages/db/init/01-schema.sql
```

## Seeding Data

```bash
# Seed demo user and 90 days of sample data
pnpm db:seed
```

This creates:
- Demo user (demo@kalix.local / demo123)
- ~150 todos with varying completion status
- ~100 diary entries
- ~200 mood logs

## Smoke Tests

```bash
pnpm db:smoke
```

Validates:
- Schema exists
- All tables created
- Triggers working
- User isolation enforced

## Backup & Restore

### Backup

```bash
# Full backup
pg_dump -Fc $DATABASE_URL > backup.dump

# Schema only
pg_dump -Fc --schema=dear_diary $DATABASE_URL > schema.dump
```

### Restore

```bash
pg_restore -d $DATABASE_URL backup.dump
```

## Common Queries

### Get user stats for dashboard

```sql
SELECT 
  COUNT(*) FILTER (WHERE status = 'done') as completed,
  COUNT(*) as total
FROM dear_diary.todos
WHERE user_id = $1 
  AND local_date >= CURRENT_DATE - INTERVAL '7 days';
```

### Daily mood average

```sql
SELECT 
  local_date,
  AVG(mood_score)::NUMERIC(3,2) as avg_mood
FROM dear_diary.mood_logs
WHERE user_id = $1
GROUP BY local_date
ORDER BY local_date DESC
LIMIT 30;
```

### Full-text diary search

```sql
SELECT *
FROM dear_diary.diary_entries
WHERE user_id = $1
  AND to_tsvector('english', raw_text) @@ plainto_tsquery('english', $2)
ORDER BY local_date DESC;
```
