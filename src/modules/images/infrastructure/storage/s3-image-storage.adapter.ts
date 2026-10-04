import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { ImageStoragePort, StoredImageObject, StoreImageInput, StoredImage } from '../../application/ports/image-storage.port';

@Injectable()
export class S3ImageStorageAdapter implements ImageStoragePort {
  private readonly logger = new Logger(S3ImageStorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseFolder: string;
  private readonly imageFolder: string;
  private readonly publicBaseUrl: string | undefined;
  private readonly maxWidth: number;

  constructor(configService: ConfigService) {
    const endpoint = configService.get<string>('RMU_MEDIA_S3_ENDPOINT');
    const forcePathStyle =
      configService.get<string | boolean>('RMU_MEDIA_S3_FORCE_PATH_STYLE') === true ||
      configService.get<string>('RMU_MEDIA_S3_FORCE_PATH_STYLE') === 'true';
    const accessKeyId = configService.get<string>('RMU_MEDIA_S3_ACCESS_KEY_ID');
    const secretAccessKey = configService.get<string>('RMU_MEDIA_S3_SECRET_ACCESS_KEY');

    this.bucket = configService.getOrThrow<string>('RMU_MEDIA_S3_BUCKET');
    this.baseFolder = this.normalizePrefix(configService.get<string>('RMU_MEDIA_S3_BASE_FOLDER') ?? '');
    this.imageFolder = this.normalizePrefix(configService.get<string>('RMU_MEDIA_S3_IMAGE_FOLDER') ?? '');
    this.publicBaseUrl = configService.get<string>('RMU_MEDIA_S3_PUBLIC_BASE_URL');
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
    const s3Key = this.toS3Key(storageKey);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
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

  async list(prefix: string): Promise<StoredImageObject[]> {
    const objects: StoredImageObject[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.toS3Prefix(prefix),
          ContinuationToken: continuationToken,
        }),
      );

      for (const item of page.Contents ?? []) {
        if (!item.Key || item.Key.endsWith('/')) continue;
        const storageKey = this.toStorageKey(item.Key);
        const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: item.Key }));
        objects.push({
          storageKey,
          url: this.buildUrl(storageKey),
          contentType: head.ContentType ?? this.inferContentType(storageKey),
          sizeBytes: item.Size ?? head.ContentLength ?? 0,
          lastModified: item.LastModified,
        });
      }

      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    return objects;
  }

  async delete(storageKey: string): Promise<void> {
    if (!storageKey) return;
    const s3Key = this.toS3Key(storageKey);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    } catch (error) {
      this.logger.warn(`Could not delete image object ${s3Key}: ${(error as Error).message}`);
    }
  }

  private async scale(content: Buffer, contentType: string) {
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

  private normalizeOutputType(contentType: string) {
    return contentType === 'image/png' ? 'image/png' : 'image/jpeg';
  }

  private buildStorageKey(input: StoreImageInput, contentType: string) {
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const suffix = `${input.category}/${input.imageId}.${extension}`;
    return this.imageFolder ? `${this.imageFolder}/${suffix}` : suffix;
  }

  private normalizePrefix(prefix: string) {
    return prefix.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  private toS3Key(storageKey: string) {
    const normalizedStorageKey = this.normalizePrefix(storageKey);
    if (!this.baseFolder) return normalizedStorageKey;
    return normalizedStorageKey ? `${this.baseFolder}/${normalizedStorageKey}` : this.baseFolder;
  }

  private toS3Prefix(prefix: string) {
    const s3Key = this.toS3Key(prefix);
    return s3Key ? `${s3Key}/` : '';
  }

  private toStorageKey(s3Key: string) {
    const normalizedS3Key = this.normalizePrefix(s3Key);
    if (!this.baseFolder) return normalizedS3Key;
    if (normalizedS3Key === this.baseFolder) return '';
    return normalizedS3Key.startsWith(`${this.baseFolder}/`) ? normalizedS3Key.slice(this.baseFolder.length + 1) : normalizedS3Key;
  }

  private inferContentType(storageKey: string) {
    const lowered = storageKey.toLowerCase();
    if (lowered.endsWith('.png')) return 'image/png';
    if (lowered.endsWith('.webp')) return 'image/webp';
    if (lowered.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  private buildUrl(storageKey: string) {
    if (this.publicBaseUrl) return `${this.publicBaseUrl.replace(/\/$/, '')}/${storageKey}`;
    return `https://${this.bucket}.s3.amazonaws.com/${storageKey}`;
  }
}
