import { z } from 'zod';

export const moodSourceSchema = z.enum(['telegram', 'web', 'api']);

export const moodLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  moodScore: z.number().int().min(1).max(5),
  note: z.string().nullable(),
  localDate: z.string(), // DATE as ISO string
  source: moodSourceSchema,
  telegramMessageId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
});

export const createMoodLogSchema = z.object({
  moodScore: z.number().int().min(1).max(5),
  note: z.string().optional(),
  source: moodSourceSchema.default('api'),
  telegramMessageId: z.number().int().positive().optional(),
  localDate: z.string().optional(), // YYYY-MM-DD, defaults to today
});

export const moodQuerySchema = z.object({
  range: z.enum(['week', 'month', 'all']).default('week'),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MoodLog = z.infer<typeof moodLogSchema>;
export type CreateMoodLog = z.infer<typeof createMoodLogSchema>;
export type MoodQuery = z.infer<typeof moodQuerySchema>;
export type MoodSource = z.infer<typeof moodSourceSchema>;
