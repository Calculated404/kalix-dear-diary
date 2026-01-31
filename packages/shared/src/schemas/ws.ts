import { z } from 'zod';
import { createTodoSchema, updateTodoSchema, completeTodoSchema } from './todo.js';
import { createDiaryEntrySchema } from './diary.js';
import { createMoodLogSchema } from './mood.js';

// ============================================
// WebSocket Message Types
// ============================================

// Auth messages
export const wsAuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

export const wsAuthOkMessageSchema = z.object({
  type: z.literal('auth.ok'),
});

export const wsAuthErrorMessageSchema = z.object({
  type: z.literal('auth.error'),
  message: z.string(),
});

// Command messages (from client)
export const wsTodoCreateMessageSchema = z.object({
  type: z.literal('todo.create'),
  requestId: z.string().uuid(),
  data: createTodoSchema,
});

export const wsTodoUpdateMessageSchema = z.object({
  type: z.literal('todo.update'),
  requestId: z.string().uuid(),
  todoId: z.string().uuid(),
  data: updateTodoSchema,
});

export const wsTodoCompleteMessageSchema = z.object({
  type: z.literal('todo.complete'),
  requestId: z.string().uuid(),
  todoId: z.string().uuid(),
  data: completeTodoSchema.optional(),
});

export const wsDiaryCreateMessageSchema = z.object({
  type: z.literal('diary.create'),
  requestId: z.string().uuid(),
  data: createDiaryEntrySchema,
});

export const wsMoodLogMessageSchema = z.object({
  type: z.literal('mood.log'),
  requestId: z.string().uuid(),
  data: createMoodLogSchema,
});

// Ack messages (server response to commands)
export const wsAckSuccessMessageSchema = z.object({
  type: z.literal('ack'),
  requestId: z.string().uuid(),
  ok: z.literal(true),
  data: z.unknown(),
});

export const wsAckErrorMessageSchema = z.object({
  type: z.literal('ack'),
  requestId: z.string().uuid(),
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export const wsAckMessageSchema = z.union([
  wsAckSuccessMessageSchema,
  wsAckErrorMessageSchema,
]);

// Broadcast event messages (server → clients)
export const wsEventTodoCreatedSchema = z.object({
  type: z.literal('event.todo.created'),
  data: z.unknown(), // Todo
});

export const wsEventTodoUpdatedSchema = z.object({
  type: z.literal('event.todo.updated'),
  data: z.unknown(), // Todo
});

export const wsEventTodoCompletedSchema = z.object({
  type: z.literal('event.todo.completed'),
  data: z.unknown(), // Todo
});

export const wsEventDiaryCreatedSchema = z.object({
  type: z.literal('event.diary.created'),
  data: z.unknown(), // DiaryEntry
});

export const wsEventMoodLoggedSchema = z.object({
  type: z.literal('event.mood.logged'),
  data: z.unknown(), // MoodLog
});

// Union of all broadcast events
export const wsBroadcastEventSchema = z.union([
  wsEventTodoCreatedSchema,
  wsEventTodoUpdatedSchema,
  wsEventTodoCompletedSchema,
  wsEventDiaryCreatedSchema,
  wsEventMoodLoggedSchema,
]);

// Union of all client messages
export const wsClientMessageSchema = z.union([
  wsAuthMessageSchema,
  wsTodoCreateMessageSchema,
  wsTodoUpdateMessageSchema,
  wsTodoCompleteMessageSchema,
  wsDiaryCreateMessageSchema,
  wsMoodLogMessageSchema,
]);

// Union of all server messages
export const wsServerMessageSchema = z.union([
  wsAuthOkMessageSchema,
  wsAuthErrorMessageSchema,
  wsAckMessageSchema,
  wsBroadcastEventSchema,
]);

// Types
export type WSAuthMessage = z.infer<typeof wsAuthMessageSchema>;
export type WSAuthOkMessage = z.infer<typeof wsAuthOkMessageSchema>;
export type WSAuthErrorMessage = z.infer<typeof wsAuthErrorMessageSchema>;
export type WSTodoCreateMessage = z.infer<typeof wsTodoCreateMessageSchema>;
export type WSTodoUpdateMessage = z.infer<typeof wsTodoUpdateMessageSchema>;
export type WSTodoCompleteMessage = z.infer<typeof wsTodoCompleteMessageSchema>;
export type WSDiaryCreateMessage = z.infer<typeof wsDiaryCreateMessageSchema>;
export type WSMoodLogMessage = z.infer<typeof wsMoodLogMessageSchema>;
export type WSAckMessage = z.infer<typeof wsAckMessageSchema>;
export type WSBroadcastEvent = z.infer<typeof wsBroadcastEventSchema>;
export type WSClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WSServerMessage = z.infer<typeof wsServerMessageSchema>;
