# API Documentation

Base URL: `http://localhost:3001/api`

## Authentication

The API supports two authentication methods:

### 1. JWT Bearer Token (for web frontend)
```
Authorization: Bearer <access_token>
```

### 2. Service Token (for n8n/automation)
```
X-Service-Token: <service_token>
X-User-Id: <user_uuid>        # Required for user-scoped endpoints
```

**Note:** The `/auth/telegram/upsert` endpoint only requires `X-Service-Token` (no `X-User-Id`), as it's used to create/lookup users.

## Endpoints

### Health

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected"
}
```

---

### Authentication

#### POST /auth/login
Authenticate with email/password or Telegram login code.

**Request (email/password):**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Request (login code):**
```json
{
  "loginCode": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "displayName": "John",
    "timezone": "Europe/Berlin"
  }
}
```

#### POST /auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

#### POST /auth/logout
Revoke all refresh tokens.

**Headers:** Bearer token required

#### POST /auth/telegram/upsert
Create or update user by Telegram ID. **Service token required, NO X-User-Id needed.**

This endpoint is used to create users or lookup existing ones by Telegram ID.
Returns the user.id which should be used for subsequent `X-User-Id` headers.

**Headers:**
```
X-Service-Token: <token>
```

**Request:**
```json
{
  "telegramUserId": 123456789,
  "username": "johndoe",
  "displayName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegramUserId": 123456789,
    "displayName": "John Doe",
    "timezone": "Europe/Berlin"
  }
}
```

#### GET /auth/me
Get current user profile.

#### PATCH /auth/me
Update current user profile (timezone, displayName).

**Request:**
```json
{
  "timezone": "America/New_York",
  "displayName": "New Name"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "displayName": "New Name",
    "timezone": "America/New_York"
  }
}
```

---

### Todos

#### GET /todos
List todos with optional filtering.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| range | week\|month\|all | week | Date range filter |
| status | open\|done\|all | all | Status filter |
| limit | number | 100 | Max items |
| offset | number | 0 | Pagination offset |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "Buy groceries",
      "status": "open",
      "priority": 1,
      "localDate": "2024-01-15",
      "tags": ["shopping"],
      "source": "telegram",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 42,
  "limit": 100,
  "offset": 0,
  "hasMore": false
}
```

#### POST /todos
Create a new todo.

**Request:**
```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": 1,
  "dueDate": "2024-01-16",
  "tags": ["shopping"],
  "source": "telegram",
  "telegramMessageId": 12345
}
```

#### GET /todos/:id
Get a single todo.

#### PATCH /todos/:id
Update a todo.

**Request:**
```json
{
  "title": "Updated title",
  "status": "done"
}
```

#### POST /todos/:id/complete
Mark todo as complete.

#### DELETE /todos/:id
Delete a todo.

---

### Diary

#### GET /diary
List diary entries.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| range | week\|month\|all | week | Date range |
| search | string | - | Full-text search |
| tag | string | - | Filter by tag |

#### POST /diary
Create diary entry.

**Request:**
```json
{
  "rawText": "Today I learned about WebSockets...",
  "tags": ["learning", "tech"],
  "source": "telegram"
}
```

#### GET /diary/:id
Get single entry.

#### DELETE /diary/:id
Delete entry.

---

### Moods

#### GET /moods
List mood logs.

#### POST /moods
Log mood.

**Request:**
```json
{
  "moodScore": 4,
  "note": "Feeling productive",
  "source": "telegram"
}
```

---

### Statistics

#### GET /stats/overview
Get overview statistics.

**Query:** `?range=week|month|year`

**Response:**
```json
{
  "todosCreated": 15,
  "todosCompleted": 12,
  "completionRate": 0.8,
  "diaryEntryCount": 5,
  "wordCount": 1250,
  "moodAvg": 3.8,
  "moodDistribution": {
    "1": 0,
    "2": 1,
    "3": 3,
    "4": 5,
    "5": 2
  }
}
```

#### GET /stats/todos/timeseries
Daily todos created/completed.

**Response:**
```json
{
  "created": [
    { "date": "2024-01-10", "value": 3 },
    { "date": "2024-01-11", "value": 2 }
  ],
  "completed": [
    { "date": "2024-01-10", "value": 2 },
    { "date": "2024-01-11", "value": 3 }
  ]
}
```

#### GET /stats/moods/timeseries
Daily average mood.

#### GET /stats/heatmap
Heatmap data for year-in-pixels view.

**Query:** `?range=year&type=todos_completed|mood|activity`

#### GET /stats/activity
Recent activity feed.

---

## WebSocket

### Connection

Connect to: `ws://localhost:3001/ws`

### Authentication

After connecting, send auth message within 10 seconds.

#### Method 1: JWT (for web frontend)
```json
{
  "type": "auth",
  "token": "<jwt_access_token>"
}
```

#### Method 2: Service Token (for n8n/automation)
```json
{
  "type": "auth",
  "token": "<SERVICE_TOKEN>",
  "userId": "<user_uuid>"
}
```

**Important:** For service token auth, `userId` is REQUIRED and must be a valid user UUID.
Get the userId from `/auth/telegram/upsert` first.

**Success response:**
```json
{ "type": "auth.ok" }
```

**Error response:**
```json
{ "type": "auth.error", "message": "Invalid token" }
```

### Command Messages

All commands include a `requestId` for response pairing.

#### Create Todo
```json
{
  "type": "todo.create",
  "requestId": "uuid",
  "data": {
    "title": "Buy milk",
    "source": "telegram"
  }
}
```

#### Update Todo
```json
{
  "type": "todo.update",
  "requestId": "uuid",
  "todoId": "uuid",
  "data": {
    "title": "Updated title"
  }
}
```

#### Complete Todo
```json
{
  "type": "todo.complete",
  "requestId": "uuid",
  "todoId": "uuid"
}
```

#### Create Diary Entry
```json
{
  "type": "diary.create",
  "requestId": "uuid",
  "data": {
    "rawText": "Today was great...",
    "source": "telegram"
  }
}
```

#### Log Mood
```json
{
  "type": "mood.log",
  "requestId": "uuid",
  "data": {
    "moodScore": 4,
    "note": "Feeling good",
    "source": "telegram"
  }
}
```

### Response Messages

**Success:**
```json
{
  "type": "ack",
  "requestId": "uuid",
  "ok": true,
  "data": { /* created/updated entity */ }
}
```

**Error:**
```json
{
  "type": "ack",
  "requestId": "uuid",
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Todo not found"
  }
}
```

### Broadcast Events

The server broadcasts events to all connected clients of the same user:

- `event.todo.created`
- `event.todo.updated`
- `event.todo.completed`
- `event.diary.created`
- `event.mood.logged`

**Example:**
```json
{
  "type": "event.todo.created",
  "data": { /* todo object */ }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "error_code",
  "message": "Human readable message"
}
```

Common error codes:
- `validation_error` - Invalid request data
- `unauthorized` - Authentication required
- `invalid_token` - Token expired or invalid
- `not_found` - Resource not found
- `forbidden` - Permission denied
