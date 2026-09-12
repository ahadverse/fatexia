import { extname } from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ValidationError } from '../../common/errors';
import { env } from '../../common/env';

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  cdnBaseUrl: string;
}

// Env, not the `integrations` table — see the S3_* block in env.ts for why this one
// credential is exempt from the Integrations-page rule.
function resolveS3Config(): S3Config {
  const { S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION, S3_CDN_URL } = env;
  if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET || !S3_REGION || !S3_CDN_URL) {
    throw new ValidationError(
      'S3 is not configured — set S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION and S3_CDN_URL in the backend environment',
    );
  }
  return {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
    bucket: S3_BUCKET,
    region: S3_REGION,
    cdnBaseUrl: S3_CDN_URL,
  };
}

// Where each kind of upload lands in the bucket. A closed map rather than a caller-
// supplied string: the folder becomes part of an S3 key, and a key assembled from
// request input is how a caller writes outside the prefix they were meant to.
const FOLDERS = {
  offerThumbnail: 'offer-thumbnails',
  newsImage: 'news-images',
  managerAvatar: 'manager-avatars',
} as const;

export type UploadFolder = keyof typeof FOLDERS;

// "My Offer Icon!!.PNG" -> "offer-thumbnails/my-offer-icon-1699999999999.png" —
// lowercase, spaces to dashes, stripped of anything that isn't a safe S3 key
// character, with a timestamp suffix so two uploads of the same filename never collide.
function buildKey(folder: UploadFolder, originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  const base = originalName
    .slice(0, originalName.length - ext.length)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `${FOLDERS[folder]}/${base || 'image'}-${Date.now()}${ext}`;
}

export const uploadService = {
  async uploadImage(
    folder: UploadFolder,
    file: { originalname: string; buffer: Buffer; mimetype: string },
  ): Promise<string> {
    const config = resolveS3Config();
    const s3 = new S3Client({
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      region: config.region,
    });
    const key = buildKey(folder, file.originalname);
    await s3.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    return `${config.cdnBaseUrl.replace(/\/+$/, '')}/${key}`;
  },
};
