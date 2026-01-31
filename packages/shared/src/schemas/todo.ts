import { z } from 'zod';

export const todoStatusSchema = z.enum(['open', 'done', 'cancelled']);
export const todoSourceSchema = z.enum(['telegram', 'web', 'api']);

export const todoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().nullable(),
  status: todoStatusSchema,
  priority: z.number().int().min(0).max(3).default(0),
  dueDate: z.string().nullable(), // DATE as ISO string
  dueTime: z.string().nullable(), // TIME as string
  completedAt: z.string().datetime().nullable(),
  localDate: z.string(), // DATE as ISO string
  tags: z.array(z.string()),
  source: todoSourceSchema,
  telegramMessageId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createTodoSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(3).default(0),
  dueDate: z.string().optional(), // YYYY-MM-DD
  dueTime: z.string().optional(), // HH:MM
  tags: z.array(z.string()).default([]),
  source: todoSourceSchema.default('api'),
  telegramMessageId: z.number().int().positive().optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  status: todoStatusSchema.optional(),
});

export const completeTodoSchema = z.object({
  completedAt: z.string().datetime().optional(),
});

export const todoQuerySchema = z.object({
  range: z.enum(['week', 'month', 'all']).default('week'),
  status: z.enum(['open', 'done', 'all']).default('all'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodo = z.infer<typeof createTodoSchema>;
export type UpdateTodo = z.infer<typeof updateTodoSchema>;
export type CompleteTodo = z.infer<typeof completeTodoSchema>;
export type TodoQuery = z.infer<typeof todoQuerySchema>;
export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type TodoSource = z.infer<typeof todoSourceSchema>;
