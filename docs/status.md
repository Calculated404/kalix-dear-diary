# Project Status

## Current Phase: M0-M8 Complete + Integration Boundary Fixes

### Completed Milestones

- [x] **M0**: Repo scaffold - pnpm monorepo, workspace config, base tsconfig, docker-compose
- [x] **M1**: Postgres schema + init scripts + smoke tests
- [x] **M2**: API server structure + healthcheck
- [x] **M3**: Auth (SERVICE_TOKEN + JWT) + user upsert by telegram_user_id
- [x] **M4**: CRUD for todos/diary/moods (REST)
- [x] **M5**: WebSocket endpoint + parity with REST
- [x] **M6**: Stats endpoints (week/month/year)
- [x] **M7**: Seed scripts + dummy dataset (90 days of data)
- [x] **M8**: React frontend (login + dashboard + charts + pages)
- [x] **Integration Boundary Fixes**: Proper auth for n8n, WebSocket service token support

### In Progress

- [ ] **M9**: Real-time updates integration test + n8n example workflow
- [ ] **M10**: Deployment docs for Raspberry Pi

### Recent Fixes (Integration Boundaries)

1. **`/api/auth/telegram/upsert`** - Now only requires `X-Service-Token`, NOT `X-User-Id`
2. **WebSocket** - Now supports service token auth with `userId` field
3. **`PATCH /api/auth/me`** - Added endpoint for updating timezone/displayName
4. **Guardrail script** - Added `pnpm audit:boundaries` to prevent regression
5. **Documentation** - Added `docs/integration-boundaries.md`

### Next Actions

1. Run `pnpm audit:boundaries` (passes)
2. Test REST upsert without X-User-Id
3. Test WebSocket with service token + userId
4. Test Settings page timezone update

## Architecture Decisions

### Decision: Backend as Passive Datastore
**Rationale:** The backend NEVER calls external services (Google, n8n, Telegram). n8n holds all external credentials and calls the backend. See `docs/integration-boundaries.md`.

### Decision: Fastify over Express
**Rationale:** Better TypeScript support, built-in validation hooks, excellent WebSocket plugin.

### Decision: JWT for web, Service Token for n8n
**Rationale:** JWTs provide stateless auth for web clients. Service tokens are simpler for server-to-server communication with n8n.

### Decision: local_date computed at write time
**Rationale:** Storing the user's local date when creating entries ensures accurate analytics regardless of when data is queried.

### Decision: Same service layer for REST and WS
**Rationale:** Ensures identical behavior between REST API and WebSocket commands. DRY principle.

## Known Issues / TODOs

1. **Password hashing**: Currently using SHA-256. Should use bcrypt in production.
2. **Rate limiting**: Not yet implemented. Add before production.
3. **Delete account**: Endpoint stubbed but not functional.
4. **Telegram login flow**: Login codes work, but bot integration needs testing.

## Schema Changes Log

None yet - initial schema.

## Testing Coverage

- [ ] Unit tests for services
- [ ] Integration tests for API endpoints
- [x] Boundary audit script (`pnpm audit:boundaries`)
- [ ] WebSocket connection tests
- [ ] User isolation tests

## Dependencies Notes

- Using `date-fns` for date formatting in frontend (lighter than moment)
- Using `recharts` for charts (good React integration)
- Avoiding heavy dependencies for Raspberry Pi compatibility
- NO Google APIs, axios, or outbound HTTP clients in backend
