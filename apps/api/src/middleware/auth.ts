import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthContext } from '@kalix/shared';

// Extend request types
declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
    serviceTokenValidated?: boolean;
  }
}

/**
 * Validate service token only (no user_id required).
 * Returns true if valid, sends error response and returns false otherwise.
 */
function validateServiceToken(
  request: FastifyRequest,
  reply: FastifyReply
): boolean {
  const serviceToken = request.headers['x-service-token'];
  const expectedToken = process.env['SERVICE_TOKEN'];

  if (!expectedToken) {
    reply.status(500).send({
      error: 'server_error',
      message: 'Service token not configured',
    });
    return false;
  }

  if (serviceToken !== expectedToken) {
    reply.status(401).send({
      error: 'invalid_token',
      message: 'Invalid service token',
    });
    return false;
  }

  return true;
}

/**
 * Middleware to authenticate requests via JWT or SERVICE_TOKEN
 * Populates request.authContext with user info
 * 
 * For service token auth, X-User-Id header is REQUIRED (user-scoped endpoints).
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const serviceToken = request.headers['x-service-token'];
  const authHeader = request.headers.authorization;

  // Check service token first
  if (serviceToken) {
    if (!validateServiceToken(request, reply)) {
      return;
    }

    // For service token on user-scoped endpoints, X-User-Id is required
    const userId = request.headers['x-user-id'] as string | undefined;
    if (!userId) {
      return reply.status(400).send({
        error: 'missing_user_id',
        message: 'X-User-Id header required with service token for this endpoint',
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
 * Middleware that validates service token ONLY (no X-User-Id required).
 * Use for endpoints like /telegram/upsert where user doesn't exist yet.
 * 
 * Sets request.serviceTokenValidated = true if valid.
 */
export async function requireServiceTokenOnly(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const serviceToken = request.headers['x-service-token'];

  if (!serviceToken) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Service token required (X-Service-Token header)',
    });
  }

  if (!validateServiceToken(request, reply)) {
    return;
  }

  request.serviceTokenValidated = true;
}

/**
 * Middleware that requires service token WITH X-User-Id (user-scoped automation endpoints)
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
