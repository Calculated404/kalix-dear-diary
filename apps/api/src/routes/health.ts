import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['System'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            database: { type: 'string' },
          },
        },
      },
    },
  }, async (_request, reply) => {
    // Check database connectivity
    let dbStatus = 'unknown';
    try {
      const client = await fastify.pool.connect();
      await client.query('SELECT 1');
      client.release();
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  });
};
