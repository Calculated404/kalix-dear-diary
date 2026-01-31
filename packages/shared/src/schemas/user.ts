import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  telegramUserId: z.number().int().positive().nullable(),
  username: z.string().max(255).nullable(),
  email: z.string().email().max(255).nullable(),
  displayName: z.string().max(255).nullable(),
  timezone: z.string().default('Europe/Berlin'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
});

export const createUserSchema = z.object({
  telegramUserId: z.number().int().positive().optional(),
  username: z.string().max(255).optional(),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(255).optional(),
  displayName: z.string().max(255).optional(),
  timezone: z.string().default('Europe/Berlin'),
});

export const updateUserSchema = z.object({
  displayName: z.string().max(255).optional(),
  timezone: z.string().optional(),
});

export const upsertTelegramUserSchema = z.object({
  telegramUserId: z.number().int().positive(),
  username: z.string().max(255).optional(),
  displayName: z.string().max(255).optional(),
});

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UpsertTelegramUser = z.infer<typeof upsertTelegramUserSchema>;
