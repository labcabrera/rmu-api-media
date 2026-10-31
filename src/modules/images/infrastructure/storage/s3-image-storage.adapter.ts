import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { ImageStoragePort, StoreImageInput, StoredImage } from '../../application/ports/image-storage.port.js';
import { ValidationError } from '../../../shared/domain/errors/errors.js';

/** The formats sharp must detect in an upload. */
const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp']);

@Injectable()
export class S3ImageStorageAdapter implements ImageStoragePort {
  private readonly logger = new Logger(S3ImageStorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly uploadsPrefix: string;
  private readonly maxWidth: number;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('RMU_MEDIA_S3_ENDPOINT');
    const forcePathStyle =
      configService.get<string | boolean>('RMU_MEDIA_S3_FORCE_PATH_STYLE') === true ||
      configService.get<string>('RMU_MEDIA_S3_FORCE_PATH_STYLE') === 'true';
    const accessKeyId = configService.get<string>('RMU_MEDIA_S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('RMU_MEDIA_S3_SECRET_ACCESS_KEY');

    this.bucket = configService.getOrThrow<string>('RMU_MEDIA_S3_BUCKET');
    this.uploadsPrefix = this.normalizePrefix(configService.get<string>('RMU_MEDIA_S3_UPLOADS_PREFIX') ?? 'uploads');
    this.maxWidth = configService.get<number>('RMU_MEDIA_IMAGE_MAX_WIDTH') ?? 2048;

    this.client = new S3Client({
      region: configService.getOrThrow<string>('RMU_MEDIA_S3_REGION'),
      endpoint,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async store(input: StoreImageInput): Promise<StoredImage> {
    const processed = await this.scale(input.content, input.contentType);
    const storageKey = this.buildStorageKey(input, processed.contentType);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: processed.content,
        ContentType: processed.contentType,
      }),
    );

    return {
      storageKey,
      url: this.buildUrl(storageKey),
      contentType: processed.contentType,
      sizeBytes: processed.content.length,
      width: processed.width,
      height: processed.height,
    };
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey) return;
    const s3Key = this.normalizePrefix(storageKey);
    // Only objects of the uploads prefix belong to this API: a key of the old layout (images/<category>/..., before
    // spec 057) is left for scripts/move-uploads.mjs, and nothing can remove a file of rmu-mfe-assets.
    if (!s3Key.startsWith(`${this.uploadsPrefix}/`)) {
      this.logger.warn(`Not deleting ${s3Key}: it is outside the uploads prefix ${this.uploadsPrefix}/`);
      return;
    }
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    } catch (error) {
      this.logger.warn(`Could not delete image object ${s3Key}: ${(error as Error).message}`);
    }
  }

  private async scale(content: Buffer, contentType: string) {
    await this.checkImage(content);
    const pipeline = sharp(content).rotate().resize({ width: this.maxWidth, withoutEnlargement: true });
    const outputType = this.normalizeOutputType(contentType);
    const output =
      outputType === 'image/png'
        ? await pipeline.png().toBuffer({ resolveWithObject: true })
        : await pipeline.jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });

    return {
      content: output.data,
      contentType: outputType,
      width: output.info.width,
      height: output.info.height,
    };
  }

  /** The content, not only the declared type, must be a PNG, JPEG or WebP image (spec 057, decision 9). */
  private async checkImage(content: Buffer) {
    let format: string | undefined;
    try {
      format = (await sharp(content).metadata()).format;
    } catch {
      format = undefined;
    }
    if (!format || !ACCEPTED_FORMATS.has(format)) throw new ValidationError('The file is not a PNG, JPEG or WebP image');
  }

  private normalizeOutputType(contentType: string) {
    return contentType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  private buildStorageKey(input: StoreImageInput, contentType: string) {
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    return `${this.uploadsPrefix}/${input.category}/${input.imageId}.${extension}`;
  }

  private normalizePrefix(prefix: string) {
    return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  // The URL is the object key, `uploads/<category>/<id>.<ext>`: the frontends resolve `uploads/...` against their
  // RMU_MFE_MEDIA_URI (spec 057, decision 4), so no public host is stored.
  private buildUrl(storageKey: string) {
    return storageKey;
  }
}
