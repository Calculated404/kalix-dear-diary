import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { loginRequestSchema, upsertTelegramUserSchema } from '@kalix/shared';
import { UserService } from '../services/user.js';
import { requireServiceToken, authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const userService = new UserService(fastify.pool);

  // Login endpoint (email/password or login code)
  fastify.post('/login', {
    schema: {
      description: 'Authenticate user with email/password or Telegram login code',
      tags: ['Auth'],
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          loginCode: { type: 'string', minLength: 6, maxLength: 6 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                displayName: { type: 'string', nullable: true },
                timezone: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const parseResult = loginRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const { email, password, loginCode } = parseResult.data;
    let user;

    if (loginCode) {
      // Verify login code
      user = await userService.verifyLoginCode(loginCode);
      if (!user) {
        return reply.status(401).send({
          error: 'invalid_code',
          message: 'Invalid or expired login code',
        });
      }
    } else if (email && password) {
      // Verify email/password
      user = await userService.verifyPassword(email, password);
      if (!user) {
        return reply.status(401).send({
          error: 'invalid_credentials',
          message: 'Invalid email or password',
        });
      }
    } else {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Either loginCode or email+password required',
      });
    }

    // Generate tokens
    const accessToken = fastify.jwt.sign(
      { sub: user.id, type: 'access' },
      { expiresIn: '15m' }
    );
    
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    );

    // Store refresh token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await userService.storeRefreshToken(user.id, tokenHash, 7 * 24 * 60 * 60);

    // Update last login
    await userService.updateLastLogin(user.id);

    return reply.send({
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        displayName: user.displayName,
        timezone: user.timezone,
      },
    });
  });

  // Refresh token endpoint
  fastify.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const payload = fastify.jwt.verify<{ sub: string; type: string }>(refreshToken);
      
      if (payload.type !== 'refresh') {
        return reply.status(401).send({
          error: 'invalid_token',
          message: 'Invalid token type',
        });
      }

      // Verify refresh token exists and is valid
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const isValid = await userService.verifyRefreshToken(payload.sub, tokenHash);
      
      if (!isValid) {
        return reply.status(401).send({
          error: 'invalid_token',
          message: 'Refresh token revoked or expired',
        });
      }

      // Get user
      const user = await userService.getById(payload.sub);
      if (!user) {
        return reply.status(401).send({
          error: 'user_not_found',
          message: 'User not found',
        });
      }

      // Generate new access token
      const accessToken = fastify.jwt.sign(
        { sub: user.id, type: 'access' },
        { expiresIn: '15m' }
      );

      return reply.send({
        accessToken,
        expiresIn: 900,
      });
    } catch {
      return reply.status(401).send({
        error: 'invalid_token',
        message: 'Invalid or expired refresh token',
      });
    }
  });

  // Logout endpoint
  fastify.post('/logout', {
    preHandler: authenticate,
    schema: {
      description: 'Logout and revoke tokens',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    await userService.revokeAllRefreshTokens(request.authContext.userId);

    return reply.send({ success: true });
  });

  // Upsert user by Telegram ID (service token only - used by n8n)
  fastify.post('/telegram/upsert', {
    preHandler: requireServiceToken,
    schema: {
      description: 'Create or update user by Telegram ID (service token required)',
      tags: ['Auth'],
      security: [{ serviceToken: [] }],
      body: {
        type: 'object',
        required: ['telegramUserId'],
        properties: {
          telegramUserId: { type: 'number' },
          username: { type: 'string' },
          displayName: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const parseResult = upsertTelegramUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const user = await userService.upsertByTelegramId(parseResult.data);

    return reply.send({
      success: true,
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId,
        displayName: user.displayName,
        timezone: user.timezone,
      },
    });
  });

  // Get current user profile
  fastify.get('/me', {
    preHandler: authenticate,
    schema: {
      description: 'Get current user profile',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const user = await userService.getById(request.authContext.userId);
    if (!user) {
      return reply.status(404).send({ error: 'user_not_found' });
    }

    return reply.send({
      id: user.id,
      telegramUserId: user.telegramUserId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  });
};
