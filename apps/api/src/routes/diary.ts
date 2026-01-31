import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createDiaryEntrySchema, diaryQuerySchema } from '@kalix/shared';
import { DiaryService } from '../services/diary.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

export const diaryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const diaryService = new DiaryService(fastify.pool);

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Create diary entry
  fastify.post('/', {
    schema: {
      description: 'Create a new diary entry',
      tags: ['Diary'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      body: {
        type: 'object',
        required: ['rawText'],
        properties: {
          rawText: { type: 'string', minLength: 1 },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string', enum: ['telegram', 'web', 'api'] },
          telegramMessageId: { type: 'number' },
          localDate: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = createDiaryEntrySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const entry = await diaryService.create(auth.userId, parseResult.data);

    // Broadcast event
    fastify.wsManager.broadcastToUser(auth.userId, {
      type: 'event.diary.created',
      data: entry,
    });

    return reply.status(201).send(entry);
  });

  // Get diary entries with filtering
  fastify.get('/', {
    schema: {
      description: 'Get diary entries with optional filtering',
      tags: ['Diary'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'all'] },
          search: { type: 'string' },
          tag: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 1000 },
          offset: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = diaryQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const result = await diaryService.list(auth.userId, parseResult.data);

    return reply.send(result);
  });

  // Get single diary entry
  fastify.get('/:id', {
    schema: {
      description: 'Get a single diary entry by ID',
      tags: ['Diary'],
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

    const entry = await diaryService.getById(auth.userId, id);
    
    if (!entry) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Diary entry not found',
      });
    }

    return reply.send(entry);
  });

  // Delete diary entry
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a diary entry',
      tags: ['Diary'],
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

    const deleted = await diaryService.delete(auth.userId, id);
    
    if (!deleted) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Diary entry not found',
      });
    }

    return reply.status(204).send();
  });
};
