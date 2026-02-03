import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Pool } from 'pg';

import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { todosRoutes } from './routes/todos.js';
import { diaryRoutes } from './routes/diary.js';
import { moodsRoutes } from './routes/moods.js';
import { statsRoutes } from './routes/stats.js';
import { wsHandler } from './ws/handler.js';
import { wsConnectionManager } from './ws/connections.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    pool: Pool;
    wsManager: typeof wsConnectionManager;
  }
}

export interface ServerOptions {
  pool: Pool;
}

export async function buildServer(options: ServerOptions) {
  const { pool } = options;

  // Use plain pino (no pino-pretty) so the server runs in Docker where pino-pretty is not installed
  const server = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
    },
  });

  // Decorate with pool and ws manager
  server.decorate('pool', pool);
  server.decorate('wsManager', wsConnectionManager);

  // CORS
  await server.register(cors, {
    origin: process.env['NODE_ENV'] === 'production'
      ? [process.env['FRONTEND_URL'] || 'http://localhost:3011']
      : true,
    credentials: true,
  });

  // JWT
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  await server.register(jwt, {
    secret: jwtSecret,
  });

  // WebSocket
  await server.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
    },
  });

  // Swagger documentation
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Kalix Dear Diary API',
        description: 'API for the Kalix Dear Diary personal diary and task management system',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3010', description: 'Development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          serviceToken: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Service-Token',
          },
        },
      },
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register routes
  await server.register(healthRoutes, { prefix: '/api' });
  await server.register(authRoutes, { prefix: '/api/auth' });
  await server.register(todosRoutes, { prefix: '/api/todos' });
  await server.register(diaryRoutes, { prefix: '/api/diary' });
  await server.register(moodsRoutes, { prefix: '/api/moods' });
  await server.register(statsRoutes, { prefix: '/api/stats' });

  // WebSocket endpoint
  server.get('/ws', { websocket: true }, wsHandler);

  return server;
}
