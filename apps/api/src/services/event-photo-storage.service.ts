import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import crypto from 'crypto'
import sharp from 'sharp'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * Event-photo storage adapter.
 * Uses Cloudflare R2 if R2_ACCESS_KEY_ID is set, otherwise falls back to the
 * local filesystem so the photo wall works in dev without external services.
 * Local files are served by Fastify via the /uploads/* route.
 */

const R2_CONFIGURED =
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_ACCOUNT_ID

const BUCKET = process.env.R2_BUCKET_NAME ?? 'wishly-uploads'
const CDN_URL = process.env.R2_PUBLIC_URL ?? 'https://cdn.partyfi.app'

const LOCAL_ROOT = process.env.LOCAL_UPLOAD_DIR ?? path.resolve(process.cwd(), 'local-uploads')
const API_PUBLIC_URL = process.env.API_URL ?? 'http://localhost:3001'

const s3 = R2_CONFIGURED
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

export interface UploadedPhoto {
  /** Storage key (r2Key column) — for R2, the S3 key; for local, relative path */
  storageKey: string
  /** Public URL — CDN URL for R2, /uploads/... for local */
  publicUrl: string
  width: number
  height: number
  sizeBytes: number
}

export async function uploadEventPhoto(
  buffer: Buffer,
  eventId: string,
): Promise<UploadedPhoto> {
  // Optimize: max 2000px on longest side, WebP, q=85
  const img = sharp(buffer)
  const meta = await img.metadata()
  const optimized = await img
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()

  const id = crypto.randomUUID()
  const key = `events/${eventId}/${id}.webp`

  if (s3) {
    // R2 upload
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    return {
      storageKey: key,
      publicUrl: `${CDN_URL}/${key}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      sizeBytes: optimized.byteLength,
    }
  }

  // Local FS fallback
  const filePath = path.join(LOCAL_ROOT, key)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, optimized)
  return {
    storageKey: key,
    publicUrl: `${API_PUBLIC_URL}/uploads/${key}`,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    sizeBytes: optimized.byteLength,
  }
}

export async function deleteEventPhoto(storageKey: string): Promise<void> {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }))
    return
  }
  const filePath = path.join(LOCAL_ROOT, storageKey)
  if (existsSync(filePath)) {
    await fs.unlink(filePath).catch(() => {})
  }
}

export function getPublicUrlForKey(storageKey: string): string {
  if (R2_CONFIGURED) return `${CDN_URL}/${storageKey}`
  return `${API_PUBLIC_URL}/uploads/${storageKey}`
}

/**
 * Read a locally-stored file. Returns null if not found.
 * Path traversal guarded: rejects any key with .. or absolute paths.
 */
export async function readLocalFile(storageKey: string): Promise<Buffer | null> {
  if (storageKey.includes('..') || path.isAbsolute(storageKey)) return null
  const filePath = path.join(LOCAL_ROOT, storageKey)
  // Verify resolved path is still under LOCAL_ROOT
  if (!path.resolve(filePath).startsWith(path.resolve(LOCAL_ROOT))) return null
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

export const isR2Configured = () => R2_CONFIGURED
