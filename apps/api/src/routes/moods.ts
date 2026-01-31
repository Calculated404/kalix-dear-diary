import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createMoodLogSchema, moodQuerySchema } from '@kalix/shared';
import { MoodService } from '../services/mood.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

export const moodsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const moodService = new MoodService(fastify.pool);

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Log mood
  fastify.post('/', {
    schema: {
      description: 'Log a new mood entry',
      tags: ['Moods'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      body: {
        type: 'object',
        required: ['moodScore'],
        properties: {
          moodScore: { type: 'number', minimum: 1, maximum: 5 },
          note: { type: 'string' },
          source: { type: 'string', enum: ['telegram', 'web', 'api'] },
          telegramMessageId: { type: 'number' },
          localDate: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = createMoodLogSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const mood = await moodService.create(auth.userId, parseResult.data);

    // Broadcast event
    fastify.wsManager.broadcastToUser(auth.userId, {
      type: 'event.mood.logged',
      data: mood,
    });

    return reply.status(201).send(mood);
  });

  // Get mood logs with filtering
  fastify.get('/', {
    schema: {
      description: 'Get mood logs with optional filtering',
      tags: ['Moods'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'all'] },
          limit: { type: 'number', minimum: 1, maximum: 1000 },
          offset: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = moodQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const result = await moodService.list(auth.userId, parseResult.data);

    return reply.send(result);
  });

  // Get single mood log
  fastify.get('/:id', {
    schema: {
      description: 'Get a single mood log by ID',
      tags: ['Moods'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };

    const mood = await moodService.getById(auth.userId, id);
    
    if (!mood) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Mood log not found',
      });
    }

    return reply.send(mood);
  });

  // Delete mood log
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a mood log',
      tags: ['Moods'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };

    const deleted = await moodService.delete(auth.userId, id);
    
    if (!deleted) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Mood log not found',
      });
    }

    return reply.status(204).send();
  });
};
