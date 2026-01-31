import { z } from 'zod';

export const diarySourceSchema = z.enum(['telegram', 'web', 'api']);

export const diaryEntrySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  rawText: z.string(),
  wordCount: z.number().int().min(0),
  localDate: z.string(), // DATE as ISO string
  tags: z.array(z.string()),
  source: diarySourceSchema,
  telegramMessageId: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createDiaryEntrySchema = z.object({
  rawText: z.string().min(1),
  tags: z.array(z.string()).default([]),
  source: diarySourceSchema.default('api'),
  telegramMessageId: z.number().int().positive().optional(),
  localDate: z.string().optional(), // YYYY-MM-DD, defaults to today in user's tz
});

export const updateDiaryEntrySchema = z.object({
  rawText: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export const diaryQuerySchema = z.object({
  range: z.enum(['week', 'month', 'all']).default('week'),
  search: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export type DiaryEntry = z.infer<typeof diaryEntrySchema>;
export type CreateDiaryEntry = z.infer<typeof createDiaryEntrySchema>;
export type UpdateDiaryEntry = z.infer<typeof updateDiaryEntrySchema>;
export type DiaryQuery = z.infer<typeof diaryQuerySchema>;
export type DiarySource = z.infer<typeof diarySourceSchema>;
