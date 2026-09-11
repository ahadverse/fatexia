import { extname } from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ValidationError } from '../../common/errors';
import { integrationRepository } from '../integrations/integration.repository';
import { IntegrationProvider, IntegrationStatus } from '../integrations/integration.entity';

interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  cdnBaseUrl: string;
}

// Not cached like getIntegrationApiKey — uploads are a rare admin action, not a
// per-click hot path, so there's no reason to trade a 60s-stale credential for one
// avoided query.
async function resolveS3Config(): Promise<S3Config> {
  const integration = await integrationRepository.findByProvider(IntegrationProvider.S3);
  if (!integration || integration.status === IntegrationStatus.DISABLED) {
    throw new ValidationError('S3 is not configured — add credentials on the Integrations page first');
  }
  const config = integration.config ?? {};
  const bucket = String(config.bucket ?? '').trim();
  const region = String(config.region ?? '').trim();
  const cdnBaseUrl = String(config.cdnBaseUrl ?? '').trim();
  if (!integration.apiKey || !integration.apiSecret || !bucket || !region || !cdnBaseUrl) {
    throw new ValidationError('S3 is missing required configuration (access key, secret, bucket, region or CDN base URL)');
  }
  return { accessKeyId: integration.apiKey, secretAccessKey: integration.apiSecret, bucket, region, cdnBaseUrl };
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
    const config = await resolveS3Config();
    const s3 = new S3Client({
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      region: config.region,
    });
    const key = buildKey(folder, file.originalname);
    await s3.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    return `${config.cdnBaseUrl.replace(/\/+$/, '')}/${key}`;
  },
};
