import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext } from '@kalix/shared';

// Extend request types
declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

/**
 * Middleware to authenticate requests via JWT or SERVICE_TOKEN
 * Populates request.authContext with user info
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const serviceToken = request.headers['x-service-token'];
  const authHeader = request.headers.authorization;

  // Check service token first
  if (serviceToken) {
    const expectedToken = process.env['SERVICE_TOKEN'];
    if (!expectedToken) {
      return reply.status(500).send({
        error: 'server_error',
        message: 'Service token not configured',
      });
    }

    if (serviceToken !== expectedToken) {
      return reply.status(401).send({
        error: 'invalid_token',
        message: 'Invalid service token',
      });
    }

    // For service token, we need the user_id from another header or body
    const userId = request.headers['x-user-id'] as string | undefined;
    if (!userId) {
      return reply.status(400).send({
        error: 'missing_user_id',
        message: 'X-User-Id header required with service token',
      });
    }

    request.authContext = {
      type: 'service_token',
      userId,
      isServiceToken: true,
    };
    return;
  }

  // Check JWT bearer token
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = await request.jwtVerify<{ sub: string; type: string }>();
      
      if (payload.type !== 'access') {
        return reply.status(401).send({
          error: 'invalid_token',
          message: 'Invalid token type',
        });
      }

      request.authContext = {
        type: 'jwt',
        userId: payload.sub,
        isServiceToken: false,
      };
      return;
    } catch {
      return reply.status(401).send({
        error: 'invalid_token',
        message: 'Invalid or expired token',
      });
    }
  }

  return reply.status(401).send({
    error: 'unauthorized',
    message: 'Authentication required',
  });
}

/**
 * Get authenticated user ID - throws if not authenticated
 */
export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.authContext) {
    throw new Error('Authentication required');
  }
  return request.authContext;
}

/**
 * Middleware that only allows service token auth (for admin/n8n endpoints)
 */
export async function requireServiceToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authenticate(request, reply);
  
  if (reply.sent) return;
  
  if (!request.authContext?.isServiceToken) {
    return reply.status(403).send({
      error: 'forbidden',
      message: 'Service token required for this endpoint',
    });
  }
}
