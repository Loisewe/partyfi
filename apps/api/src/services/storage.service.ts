import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import sharp from 'sharp'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

const BUCKET = process.env.R2_BUCKET_NAME ?? 'wishly-uploads'
const CDN_URL = process.env.R2_PUBLIC_URL ?? 'https://cdn.wishly.app'

export async function uploadImage(
  buffer: Buffer,
  contentType: string,
  folder: 'items' | 'avatars' | 'covers',
): Promise<string> {
  // Optimize image with sharp
  let optimized: Buffer
  try {
    optimized = await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    contentType = 'image/webp'
  } catch {
    // If sharp fails (non-image or unsupported), upload original
    optimized = buffer
  }

  const key = `${folder}/${crypto.randomUUID()}.webp`

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: optimized,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  return `${CDN_URL}/${key}`
}

export async function deleteImage(cdnUrl: string): Promise<void> {
  // Extract key from CDN URL
  const key = cdnUrl.replace(`${CDN_URL}/`, '')
  if (!key || key === cdnUrl) return // not our URL

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Generate a presigned URL for client-side uploads (future feature)
export async function getUploadPresignedUrl(
  folder: 'items' | 'avatars' | 'covers',
  contentType: string,
): Promise<{ uploadUrl: string; cdnUrl: string }> {
  const ext = contentType.split('/')[1] ?? 'bin'
  const key = `${folder}/${crypto.randomUUID()}.${ext}`

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }, // 5 minutes
  )

  return { uploadUrl, cdnUrl: `${CDN_URL}/${key}` }
}
