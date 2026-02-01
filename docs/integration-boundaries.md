# Integration Boundaries

This document defines the architectural boundaries for the Kalix Dear Diary system.

## Core Principle

**The backend is a passive datastore/API only.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                              n8n                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │
│  │ Telegram │  │  Gmail   │  │ Calendar │  ← n8n holds all          │
│  │   Bot    │  │   API    │  │   API    │    external credentials   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │
│       │             │             │                                  │
│       └─────────────┴─────────────┘                                  │
│                     │                                                │
│                     ▼                                                │
│            ┌────────────────┐                                        │
│            │ Parse & Route  │                                        │
│            └────────┬───────┘                                        │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
                      │ REST + WebSocket (SERVICE_TOKEN)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend API                                  │
│                                                                      │
│   • Stores data (todos, diary, moods)                               │
│   • Serves statistics                                                │
│   • Broadcasts real-time updates                                     │
│   • NEVER calls external services                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                      │
                      │ REST + WebSocket (JWT)
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Frontend                                  │
│                                                                      │
│   • Dashboard with charts                                            │
│   • Todo/Diary/Mood management                                       │
│   • Real-time updates via WebSocket                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## What the Backend MUST NOT Do

### 1. No Outbound HTTP Calls

The backend MUST NOT make outbound HTTP requests to external services.

**Forbidden:**
- Calling n8n APIs
- Calling Google APIs (Gmail, Calendar, etc.)
- Calling Telegram APIs
- Using `fetch()`, `axios`, `got`, `node-fetch`, `undici` for outbound requests

**Why:** This keeps the backend simple, secure, and free of external dependencies.

### 2. No Google/OAuth Dependencies

The backend MUST NOT have Google-related dependencies or OAuth flows.

**Forbidden packages:**
- `googleapis`
- `@google-cloud/*`
- `google-auth-library`
- Any Gmail/Calendar specific packages

**Why:** Google credentials should only exist in n8n, not the backend.

### 3. No n8n Client Code

The backend MUST NOT contain code to call n8n.

**Forbidden:**
- n8n API client libraries
- Webhook URLs pointing to n8n
- n8n-specific tokens for outbound use

**Why:** n8n calls the backend, not the other way around.

## What the Backend MUST Do

### 1. Accept Inbound Authentication

The backend authenticates inbound requests using:

**For Web Frontend (humans):**
- JWT Bearer tokens
- Standard login/refresh flow

**For n8n/Automation:**
- `X-Service-Token` header with a shared secret
- `X-User-Id` header for user-scoped operations
- Special case: `/api/auth/telegram/upsert` requires only `X-Service-Token` (no user ID)

### 2. Store and Serve Data

The backend is the source of truth for:
- User accounts
- Todos
- Diary entries
- Mood logs
- Statistics and analytics

### 3. Broadcast Real-time Events

Via WebSocket, the backend broadcasts events to connected clients:
- `event.todo.created`
- `event.todo.updated`
- `event.todo.completed`
- `event.diary.created`
- `event.mood.logged`

## n8n's Responsibilities

n8n is the "octopus" that:

1. **Receives** messages from Telegram
2. **Parses** user intent (todo, diary, mood)
3. **Calls** Google APIs if needed (Gmail, Calendar)
4. **Posts** structured data to the backend via REST or WebSocket
5. **Holds** all external service credentials (Google, Telegram bot token, etc.)

## Security Implications

| Secret | Where it lives | Purpose |
|--------|----------------|---------|
| `SERVICE_TOKEN` | Backend `.env` + n8n credentials | Authenticate n8n → backend calls |
| `JWT_SECRET` | Backend `.env` only | Sign JWTs for web auth |
| Google OAuth tokens | n8n credentials only | n8n → Google API calls |
| Telegram bot token | n8n credentials only | n8n → Telegram API calls |

## Enforcement

Run the boundary audit script to verify no violations:

```bash
pnpm audit:boundaries
```

This script checks `apps/api` for:
- Forbidden package imports
- Outbound HTTP client usage

Any violations will cause the script to fail.
