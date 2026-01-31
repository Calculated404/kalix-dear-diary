# n8n Integration Guide

This guide explains how to integrate Kalix Dear Diary with n8n workflows for Telegram automation.

## Overview

The typical flow is:
1. User sends message to Telegram bot
2. n8n receives message via Telegram Trigger
3. n8n parses intent and extracts data
4. n8n calls Kalix API (REST or WebSocket)
5. Kalix stores data and broadcasts to connected clients

## Authentication

n8n uses a **Service Token** for authentication:

1. Set `SERVICE_TOKEN` in your `.env` file
2. Store it in n8n's credentials as "Header Auth"
3. Include headers in every request:
   - `X-Service-Token: <your_service_token>`
   - `X-User-Id: <user_uuid>`

## User Management

Before processing user messages, ensure the user exists:

### Upsert User by Telegram ID

```http
POST /api/auth/telegram/upsert
X-Service-Token: <token>
Content-Type: application/json

{
  "telegramUserId": 123456789,
  "username": "johndoe",
  "displayName": "John Doe"
}
```

This creates the user if they don't exist, or updates their info.

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

Store the `user.id` for subsequent API calls.

## Message Parsing

Parse Telegram messages to detect intent. Example patterns:

| Pattern | Intent | Example |
|---------|--------|---------|
| `todo:` or `task:` | Create todo | "todo: buy milk tomorrow" |
| `done:` or `complete:` | Complete todo | "done: buy milk" |
| `mood [1-5]:` | Log mood | "mood 4: felt productive" |
| `diary:` or starts with text | Create diary | "diary: today I learned..." |

### n8n Code Node Example

```javascript
const message = $input.item.json.message.text;
let intent = 'unknown';
let data = {};

// Check for todo
if (/^(todo|task):/i.test(message)) {
  intent = 'todo.create';
  data.title = message.replace(/^(todo|task):\s*/i, '').trim();
}
// Check for completion
else if (/^(done|complete):/i.test(message)) {
  intent = 'todo.complete';
  data.searchTitle = message.replace(/^(done|complete):\s*/i, '').trim();
}
// Check for mood
else if (/^mood\s*[1-5]/i.test(message)) {
  intent = 'mood.log';
  const match = message.match(/^mood\s*([1-5])(?::\s*(.*))?/i);
  data.moodScore = parseInt(match[1]);
  data.note = match[2]?.trim() || null;
}
// Check for diary
else if (/^diary:/i.test(message)) {
  intent = 'diary.create';
  data.rawText = message.replace(/^diary:\s*/i, '').trim();
}
// Default to diary for plain text
else {
  intent = 'diary.create';
  data.rawText = message;
}

return { intent, data };
```

## REST API Integration

### Create Todo

```http
POST /api/todos
X-Service-Token: <token>
X-User-Id: <user_uuid>
Content-Type: application/json

{
  "title": "Buy milk tomorrow",
  "source": "telegram",
  "telegramMessageId": 12345
}
```

### Complete Todo

First, search for the todo by title:

```http
GET /api/todos?status=open&range=all
X-Service-Token: <token>
X-User-Id: <user_uuid>
```

Then complete it:

```http
POST /api/todos/{id}/complete
X-Service-Token: <token>
X-User-Id: <user_uuid>
```

### Log Mood

```http
POST /api/moods
X-Service-Token: <token>
X-User-Id: <user_uuid>
Content-Type: application/json

{
  "moodScore": 4,
  "note": "felt productive",
  "source": "telegram",
  "telegramMessageId": 12345
}
```

### Create Diary Entry

```http
POST /api/diary
X-Service-Token: <token>
X-User-Id: <user_uuid>
Content-Type: application/json

{
  "rawText": "Today I learned about WebSockets and how they enable real-time communication.",
  "source": "telegram",
  "telegramMessageId": 12345
}
```

## WebSocket Integration (Preferred)

For better performance, use WebSocket instead of REST.

### n8n WebSocket Setup

1. Use the "WebSocket" node (or HTTP Request with WebSocket)
2. Connect to: `ws://your-api:3001/ws`
3. Send auth message first
4. Send command messages

### Authentication

```json
{
  "type": "auth",
  "token": "<service_token>"
}
```

Note: WebSocket currently requires JWT, not service token. For n8n, use REST API.

### Command Examples

**Create Todo:**
```json
{
  "type": "todo.create",
  "requestId": "unique-id",
  "data": {
    "title": "Buy milk",
    "source": "telegram"
  }
}
```

**Log Mood:**
```json
{
  "type": "mood.log",
  "requestId": "unique-id",
  "data": {
    "moodScore": 4,
    "note": "Feeling good",
    "source": "telegram"
  }
}
```

## Example n8n Workflow

```json
{
  "nodes": [
    {
      "name": "Telegram Trigger",
      "type": "n8n-nodes-base.telegramTrigger",
      "parameters": {
        "updates": ["message"]
      }
    },
    {
      "name": "Upsert User",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "http://api:3001/api/auth/telegram/upsert",
        "headers": {
          "X-Service-Token": "={{$credentials.serviceToken}}"
        },
        "body": {
          "telegramUserId": "={{$json.message.from.id}}",
          "username": "={{$json.message.from.username}}",
          "displayName": "={{$json.message.from.first_name}}"
        }
      }
    },
    {
      "name": "Parse Intent",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// See parsing example above"
      }
    },
    {
      "name": "Route by Intent",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": [
          { "value": "todo.create", "output": 0 },
          { "value": "todo.complete", "output": 1 },
          { "value": "mood.log", "output": 2 },
          { "value": "diary.create", "output": 3 }
        ]
      }
    }
  ]
}
```

## Telegram Message Examples

Users can send these messages to the bot:

| Message | Result |
|---------|--------|
| `todo: buy milk tomorrow` | Creates todo "buy milk tomorrow" |
| `task: call mom` | Creates todo "call mom" |
| `done: buy milk` | Marks matching todo as complete |
| `mood 4: felt productive` | Logs mood 4 with note |
| `mood 2` | Logs mood 2 without note |
| `diary: today I learned about TypeScript` | Creates diary entry |
| `Just a plain text message` | Creates diary entry (default) |

## Error Handling

Always check API responses for errors:

```json
{
  "error": "not_found",
  "message": "Todo not found"
}
```

For the "done:" command, if no matching open todo is found, send a helpful message back to the user via Telegram.

## Rate Limiting

The API has rate limiting. For bulk operations:
- Add delays between requests
- Use batch operations where available
- Cache user IDs to avoid repeated upserts
