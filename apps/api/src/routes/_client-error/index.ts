import type { FastifyPluginAsync } from 'fastify'

/**
 * POST /_client-error — collect client-side fatal errors when the root layout
 * itself fails to render and global-error boundary kicks in.
 *
 * Rate-limited (10 req/min per IP). Body fields all optional / truncated.
 */
export const clientErrorRoutes: FastifyPluginAsync = async (app) => {
  app.post('/_client-error', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      message?: string
      stack?: string
      digest?: string
      url?: string
      ua?: string
    }

    app.log.error(
      {
        clientError: true,
        message: body.message?.slice(0, 500),
        stack: body.stack?.slice(0, 2000),
        digest: body.digest,
        url: body.url?.slice(0, 500),
        ua: body.ua?.slice(0, 300),
        ip: request.ip,
      },
      '[client-error]',
    )

    reply.status(204).send()
  })
}
