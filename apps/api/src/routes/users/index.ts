import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { requireAuth } from '../../plugins/auth'
import { uploadImage } from '../../services/storage.service'
import multipart from '@fastify/multipart'
import type { MultipartFile } from '@fastify/multipart'

export const userRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { attachFieldsToBody: false })

  // ── GET /users/me ───────────────────────────────────────────────────────
  app.get('/me', async (request) => {
    const user = requireAuth(request)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      nickname: user.nickname,
      isAnonymous: user.isAnonymous,
      createdAt: user.createdAt.toISOString(),
    }
  })

  // ── POST /users/me/avatar ───────────────────────────────────────────────
  app.post('/me/avatar', async (request, reply) => {
    const user = requireAuth(request)

    const multipartRequest = request as FastifyRequest & { file: () => Promise<MultipartFile | undefined> }
    const data = await multipartRequest.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const cdnUrl = await uploadImage(buffer, data.mimetype, 'avatars')

    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: cdnUrl },
    })

    return { avatarUrl: updated.avatarUrl }
  })

  // ── PATCH /users/me ─────────────────────────────────────────────────────
  // Update profile name
  app.patch('/me', async (request) => {
    const user = requireAuth(request)
    const body = request.body as { name?: string }

    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        name: typeof body.name === 'string' ? body.name.slice(0, 100) : undefined,
      },
    })

    return {
      id: updated.id,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
    }
  })
}
