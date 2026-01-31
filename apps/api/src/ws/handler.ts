import type { FastifyRequest } from 'fastify';
import type { WebSocket, RawData } from 'ws';
import { wsConnectionManager } from './connections.js';
import { TodoService } from '../services/todo.js';
import { DiaryService } from '../services/diary.js';
import { MoodService } from '../services/mood.js';
import { UserService } from '../services/user.js';
import {
  wsAuthMessageSchema,
  wsTodoCreateMessageSchema,
  wsTodoUpdateMessageSchema,
  wsTodoCompleteMessageSchema,
  wsDiaryCreateMessageSchema,
  wsMoodLogMessageSchema,
} from '@kalix/shared';

// Auth timeout: 10 seconds to authenticate after connecting
const AUTH_TIMEOUT_MS = 10000;

export async function wsHandler(
  socket: WebSocket,
  request: FastifyRequest
): Promise<void> {
  const fastify = request.server;
  
  // Services
  const todoService = new TodoService(fastify.pool);
  const diaryService = new DiaryService(fastify.pool);
  const moodService = new MoodService(fastify.pool);
  const userService = new UserService(fastify.pool);

  let authenticated = false;
  let userId: string | null = null;

  // Set auth timeout
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      wsConnectionManager.send(socket, {
        type: 'auth.error',
        message: 'Authentication timeout',
      });
      socket.close(4001, 'Authentication timeout');
    }
  }, AUTH_TIMEOUT_MS);

  // Message handler
  socket.on('message', async (data: RawData) => {
    let message: unknown;
    
    try {
      message = JSON.parse(data.toString());
    } catch {
      wsConnectionManager.send(socket, {
        type: 'ack',
        requestId: 'unknown',
        ok: false,
        error: { code: 'INVALID_JSON', message: 'Invalid JSON' },
      });
      return;
    }

    // Handle authentication
    if (!authenticated) {
      const authResult = wsAuthMessageSchema.safeParse(message);
      if (!authResult.success) {
        wsConnectionManager.send(socket, {
          type: 'auth.error',
          message: 'Invalid auth message format',
        });
        return;
      }

      const { token } = authResult.data;

      // Check if it's a service token
      const serviceToken = process.env['SERVICE_TOKEN'];
      if (serviceToken && token === serviceToken) {
        // Service token auth - not supported for WS (would need user_id somehow)
        wsConnectionManager.send(socket, {
          type: 'auth.error',
          message: 'Service token not supported for WebSocket. Use JWT.',
        });
        return;
      }

      // Try JWT verification
      try {
        const payload = fastify.jwt.verify<{ sub: string; type: string }>(token);
        
        if (payload.type !== 'access') {
          wsConnectionManager.send(socket, {
            type: 'auth.error',
            message: 'Invalid token type. Use access token.',
          });
          return;
        }

        // Verify user exists
        const user = await userService.getById(payload.sub);
        if (!user) {
          wsConnectionManager.send(socket, {
            type: 'auth.error',
            message: 'User not found',
          });
          return;
        }

        // Authentication successful
        clearTimeout(authTimeout);
        authenticated = true;
        userId = payload.sub;
        wsConnectionManager.addConnection(socket, userId);

        wsConnectionManager.send(socket, { type: 'auth.ok' });
        return;
      } catch {
        wsConnectionManager.send(socket, {
          type: 'auth.error',
          message: 'Invalid or expired token',
        });
        return;
      }
    }

    // Handle commands (must be authenticated)
    if (!userId) return;

    const msg = message as { type?: string; requestId?: string };
    const requestId = msg.requestId || 'unknown';

    try {
      // todo.create
      const todoCreateResult = wsTodoCreateMessageSchema.safeParse(message);
      if (todoCreateResult.success) {
        const todo = await todoService.create(userId, todoCreateResult.data.data);
        wsConnectionManager.send(socket, {
          type: 'ack',
          requestId,
          ok: true,
          data: todo,
        });
        // Broadcast to other connections
        wsConnectionManager.broadcastToUser(userId, {
          type: 'event.todo.created',
          data: todo,
        });
        return;
      }

      // todo.update
      const todoUpdateResult = wsTodoUpdateMessageSchema.safeParse(message);
      if (todoUpdateResult.success) {
        const todo = await todoService.update(
          userId,
          todoUpdateResult.data.todoId,
          todoUpdateResult.data.data
        );
        if (!todo) {
          wsConnectionManager.send(socket, {
            type: 'ack',
            requestId,
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Todo not found' },
          });
          return;
        }
        wsConnectionManager.send(socket, {
          type: 'ack',
          requestId,
          ok: true,
          data: todo,
        });
        wsConnectionManager.broadcastToUser(userId, {
          type: 'event.todo.updated',
          data: todo,
        });
        return;
      }

      // todo.complete
      const todoCompleteResult = wsTodoCompleteMessageSchema.safeParse(message);
      if (todoCompleteResult.success) {
        const todo = await todoService.complete(userId, todoCompleteResult.data.todoId);
        if (!todo) {
          wsConnectionManager.send(socket, {
            type: 'ack',
            requestId,
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Todo not found' },
          });
          return;
        }
        wsConnectionManager.send(socket, {
          type: 'ack',
          requestId,
          ok: true,
          data: todo,
        });
        wsConnectionManager.broadcastToUser(userId, {
          type: 'event.todo.completed',
          data: todo,
        });
        return;
      }

      // diary.create
      const diaryCreateResult = wsDiaryCreateMessageSchema.safeParse(message);
      if (diaryCreateResult.success) {
        const entry = await diaryService.create(userId, diaryCreateResult.data.data);
        wsConnectionManager.send(socket, {
          type: 'ack',
          requestId,
          ok: true,
          data: entry,
        });
        wsConnectionManager.broadcastToUser(userId, {
          type: 'event.diary.created',
          data: entry,
        });
        return;
      }

      // mood.log
      const moodLogResult = wsMoodLogMessageSchema.safeParse(message);
      if (moodLogResult.success) {
        const mood = await moodService.create(userId, moodLogResult.data.data);
        wsConnectionManager.send(socket, {
          type: 'ack',
          requestId,
          ok: true,
          data: mood,
        });
        wsConnectionManager.broadcastToUser(userId, {
          type: 'event.mood.logged',
          data: mood,
        });
        return;
      }

      // Unknown message type
      wsConnectionManager.send(socket, {
        type: 'ack',
        requestId,
        ok: false,
        error: { code: 'UNKNOWN_TYPE', message: `Unknown message type: ${msg.type}` },
      });

    } catch (err) {
      console.error('WS message handler error:', err);
      wsConnectionManager.send(socket, {
        type: 'ack',
        requestId,
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      });
    }
  });

  // Close handler
  socket.on('close', () => {
    clearTimeout(authTimeout);
    wsConnectionManager.removeConnection(socket);
  });

  // Error handler
  socket.on('error', (err) => {
    console.error('WebSocket error:', err);
    clearTimeout(authTimeout);
    wsConnectionManager.removeConnection(socket);
  });
}
