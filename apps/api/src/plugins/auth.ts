import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { User } from '@wishly/db'

export interface AuthContext {
  user: User | null
  // For anonymous wishlist access: the editToken from request header/query
  editToken: string | null
  // True if the user is the owner of the current wishlist (set in route handlers)
  isOwner: boolean
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext
  }
}

const authPlugin: FastifyPluginAsync = fp(async (app) => {
  // Add auth context to every request
  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.auth = {
      user: null,
      editToken: null,
      isOwner: false,
    }

    // Extract editToken from header or query string
    const editToken =
      (request.headers['x-edit-token'] as string | undefined) ??
      (request.query as Record<string, string>)['editToken'] ??
      null

    request.auth.editToken = editToken

    // Try to authenticate via JWT
    try {
      await request.jwtVerify()
      const payload = request.user as { sub: string; isAnonymous: boolean }

      const user = await app.prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (user) {
        request.auth.user = user
      }
    } catch {
      // No valid JWT — anonymous or unauthenticated request
    }
  })
})

// Helper to require authentication (throws 401 if not authed)
export function requireAuth(request: FastifyRequest): User {
  if (!request.auth.user) {
    const err = new Error('Authentication required') as Error & { statusCode: number }
    err.statusCode = 401
    throw err
  }
  return request.auth.user
}

// Helper to get user OR null (for public endpoints)
export function optionalAuth(request: FastifyRequest): User | null {
  return request.auth.user
}

export { authPlugin }
