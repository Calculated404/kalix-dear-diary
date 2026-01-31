import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createTodoSchema, updateTodoSchema, todoQuerySchema } from '@kalix/shared';
import { TodoService } from '../services/todo.js';
import { authenticate, requireAuth } from '../middleware/auth.js';

export const todosRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const todoService = new TodoService(fastify.pool);

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Create todo
  fastify.post('/', {
    schema: {
      description: 'Create a new todo',
      tags: ['Todos'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 500 },
          description: { type: 'string' },
          priority: { type: 'number', minimum: 0, maximum: 3 },
          dueDate: { type: 'string' },
          dueTime: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string', enum: ['telegram', 'web', 'api'] },
          telegramMessageId: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = createTodoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const todo = await todoService.create(auth.userId, parseResult.data);

    // Broadcast event to WebSocket clients
    fastify.wsManager.broadcastToUser(auth.userId, {
      type: 'event.todo.created',
      data: todo,
    });

    return reply.status(201).send(todo);
  });

  // Get todos with filtering
  fastify.get('/', {
    schema: {
      description: 'Get todos with optional filtering',
      tags: ['Todos'],
      security: [{ bearerAuth: [] }, { serviceToken: [] }],
      querystring: {
        type: 'object',
        properties: {
          range: { type: 'string', enum: ['week', 'month', 'all'] },
          status: { type: 'string', enum: ['open', 'done', 'all'] },
          limit: { type: 'number', minimum: 1, maximum: 1000 },
          offset: { type: 'number', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const auth = requireAuth(request);
    
    const parseResult = todoQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const result = await todoService.list(auth.userId, parseResult.data);

    return reply.send(result);
  });

  // Get single todo
  fastify.get('/:id', {
    schema: {
      description: 'Get a single todo by ID',
      tags: ['Todos'],
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

    const todo = await todoService.getById(auth.userId, id);
    
    if (!todo) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Todo not found',
      });
    }

    return reply.send(todo);
  });

  // Update todo
  fastify.patch('/:id', {
    schema: {
      description: 'Update a todo',
      tags: ['Todos'],
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

    const parseResult = updateTodoSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: parseResult.error.message,
      });
    }

    const todo = await todoService.update(auth.userId, id, parseResult.data);
    
    if (!todo) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Todo not found',
      });
    }

    // Broadcast event
    fastify.wsManager.broadcastToUser(auth.userId, {
      type: 'event.todo.updated',
      data: todo,
    });

    return reply.send(todo);
  });

  // Complete todo
  fastify.post('/:id/complete', {
    schema: {
      description: 'Mark a todo as complete',
      tags: ['Todos'],
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

    const todo = await todoService.complete(auth.userId, id);
    
    if (!todo) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Todo not found',
      });
    }

    // Broadcast event
    fastify.wsManager.broadcastToUser(auth.userId, {
      type: 'event.todo.completed',
      data: todo,
    });

    return reply.send(todo);
  });

  // Delete todo
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a todo',
      tags: ['Todos'],
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

    const deleted = await todoService.delete(auth.userId, id);
    
    if (!deleted) {
      return reply.status(404).send({
        error: 'not_found',
        message: 'Todo not found',
      });
    }

    return reply.status(204).send();
  });
};
