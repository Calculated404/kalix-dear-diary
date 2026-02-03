import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  loginCode: z.string().length(6).optional(),
}).refine(
  (data) => (data.email && data.password) || data.loginCode,
  { message: 'Either email+password or loginCode must be provided' }
);

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  user: z.object({
    id: z.string().uuid(),
    displayName: z.string().nullable(),
    timezone: z.string(),
  }),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
  displayName: z.string().max(255).optional(),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string(),
});

export const authErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
});

// JWT payload structure
export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(), // user_id
  type: z.enum(['access', 'refresh']),
  iat: z.number(),
  exp: z.number(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
export type AuthError = z.infer<typeof authErrorSchema>;
export type JWTPayload = z.infer<typeof jwtPayloadSchema>;
