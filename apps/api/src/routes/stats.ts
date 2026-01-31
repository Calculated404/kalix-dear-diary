import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { rangeQuerySchema } from '@kalix/shared';
import { StatsService } from '../services/stats.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

export const statsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const statsService = new StatsService(fastify.pool);

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Overview stats
  fastify.get('/overview', {
    schema: {
      description: 'Get overview statistics for the dashboard',
      tags: ['Stats'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'year'] },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = rangeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const stats = await statsService.getOverview(auth.userId, parseResult.data.range);

    return reply.send(stats);
  });

  // Todos timeseries
  fastify.get('/todos/timeseries', {
    schema: {
      description: 'Get todos created/completed timeseries data',
      tags: ['Stats'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'year'] },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = rangeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const data = await statsService.getTodosTimeseries(auth.userId, parseResult.data.range);

    return reply.send(data);
  });

  // Moods timeseries
  fastify.get('/moods/timeseries', {
    schema: {
      description: 'Get average mood timeseries data',
      tags: ['Stats'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'year'] },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = rangeQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const data = await statsService.getMoodsTimeseries(auth.userId, parseResult.data.range);

    return reply.send(data);
  });

  // Heatmap data (year in pixels)
  fastify.get('/heatmap', {
    schema: {
      description: 'Get heatmap data for year-in-pixels view',
      tags: ['Stats'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'year'] },
          type: { type: 'string', enum: ['todos_completed', 'mood', 'activity'] },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { range?: string; type?: string };
    const range = (query.range || 'year') as 'week' | 'month' | 'year';
    const type = (query.type || 'activity') as 'todos_completed' | 'mood' | 'activity';

    const data = await statsService.getHeatmap(auth.userId, range, type);

    return reply.send(data);
  });

  // Recent activity feed
  fastify.get('/activity', {
    schema: {
      description: 'Get recent activity feed',
      tags: ['Stats'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { limit?: number };
    const limit = query.limit || 20;

    const activity = await statsService.getRecentActivity(auth.userId, limit);

    return reply.send(activity);
  });
};
