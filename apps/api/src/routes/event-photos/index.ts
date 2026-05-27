import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import multipart from '@fastify/multipart'
import type { MultipartFile } from '@fastify/multipart'
import {
  uploadEventPhoto,
  deleteEventPhoto,
  readLocalFile,
  getPublicUrlForKey,
} from '../../services/event-photo-storage.service'
import { publishEventEvent } from '../sse'

const MAX_FILE_SIZE = 8 * 1024 * 1024  // 8 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export const eventPhotoRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    attachFieldsToBody: false,
    limits: { fileSize: MAX_FILE_SIZE },
  })

  // ── POST /events/:id/photos ─────────────────────────────────────────────
  // Multipart upload from a guest. Returns the created photo.
  app.post('/events/:id/photos', async (request, reply) => {
    const { id: eventId } = request.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    if (event.status !== 'ACTIVE') {
      return reply.status(403).send({ error: 'Photos can only be added to active events' })
    }

    // Resolve uploader: prefer authenticated user, else create/find anon user via cookie? For now require user
    let uploaderUserId: string
    if (request.auth.user) {
      uploaderUserId = request.auth.user.id
    } else if (request.auth.editToken === event.editToken) {
      uploaderUserId = event.hostUserId
    } else {
      // Create an anonymous uploader on the fly
      const { generateNickname } = await import('@wishly/shared')
      const newUser = await app.prisma.user.create({
        data: { isAnonymous: true, nickname: generateNickname() },
      })
      uploaderUserId = newUser.id
    }

    const mpReq = request as FastifyRequest & { file: () => Promise<MultipartFile | undefined> }
    const file = await mpReq.file()
    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return reply.status(400).send({
        error: `Поддерживаются: JPG, PNG, WebP, HEIC. Загружен: ${file.mimetype}`,
      })
    }

    const buffer = await file.toBuffer()
    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(413).send({ error: 'Файл больше 8 MB' })
    }

    const uploaded = await uploadEventPhoto(buffer, eventId)

    const photo = await app.prisma.eventPhoto.create({
      data: {
        eventId,
        uploaderUserId,
        r2Key: uploaded.storageKey,
        width: uploaded.width,
        height: uploaded.height,
        sizeBytes: uploaded.sizeBytes,
      },
    })

    await publishEventEvent(app.redis, eventId, { type: 'event.photo.added', eventId })

    reply.status(201)
    return {
      photo: {
        id: photo.id,
        url: uploaded.publicUrl,
        width: photo.width,
        height: photo.height,
        createdAt: photo.createdAt.toISOString(),
      },
    }
  })

  // ── GET /events/:id/photos ──────────────────────────────────────────────
  // Public list. Returns most-recent first.
  app.get('/events/:id/photos', async (request, reply) => {
    const { id: eventId } = request.params as { id: string }
    const event = await app.prisma.event.findUnique({ where: { id: eventId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })

    const photos = await app.prisma.eventPhoto.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    })

    // Resolve uploader names in a single batched query
    const uploaderIds = [...new Set(photos.map((p) => p.uploaderUserId))]
    const uploaders = uploaderIds.length
      ? await app.prisma.user.findMany({
          where: { id: { in: uploaderIds } },
          select: { id: true, name: true, nickname: true },
        })
      : []
    const uploaderById = new Map(uploaders.map((u) => [u.id, u]))

    return {
      photos: photos.map((p) => {
        const u = uploaderById.get(p.uploaderUserId)
        return {
          id: p.id,
          url: getPublicUrlForKey(p.r2Key),
          width: p.width,
          height: p.height,
          uploaderName: u?.name ?? u?.nickname ?? 'Аноним',
          createdAt: p.createdAt.toISOString(),
        }
      }),
    }
  })

  // ── DELETE /events/:id/photos/:photoId ──────────────────────────────────
  // Host or uploader can delete.
  app.delete('/events/:id/photos/:photoId', async (request, reply) => {
    const { id: eventId, photoId } = request.params as { id: string; photoId: string }

    const photo = await app.prisma.eventPhoto.findUnique({
      where: { id: photoId },
      include: { event: true },
    })
    if (!photo || photo.eventId !== eventId) {
      return reply.status(404).send({ error: 'Photo not found' })
    }

    const isHost =
      request.auth.editToken === photo.event.editToken ||
      request.auth.user?.id === photo.event.hostUserId
    const isUploader = request.auth.user?.id === photo.uploaderUserId

    if (!isHost && !isUploader) {
      return reply.status(403).send({ error: 'Нет прав на удаление этого фото' })
    }

    await deleteEventPhoto(photo.r2Key)
    await app.prisma.eventPhoto.delete({ where: { id: photoId } })

    await publishEventEvent(app.redis, eventId, { type: 'event.photo.removed', eventId })

    reply.status(204)
  })

}

/**
 * Static file serving for local-mode uploads. Register at root, NOT under /api/v1.
 */
export const localUploadsRoute: FastifyPluginAsync = async (app) => {
  app.get('/uploads/*', async (request, reply) => {
    const params = request.params as { '*': string }
    const key = params['*']
    const buffer = await readLocalFile(key)
    if (!buffer) return reply.status(404).send({ error: 'Not found' })
    reply.header('Content-Type', key.endsWith('.webp') ? 'image/webp' : 'application/octet-stream')
    reply.header('Cache-Control', 'public, max-age=86400')
    return reply.send(buffer)
  })
}

// uploader relation isn't defined in EventPhoto schema; defensive any cast above handles it.
// Add the relation in a follow-up migration if you want strict typing.
