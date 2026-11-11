import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { S3ImageStorageAdapter } from '../../../src/modules/images/infrastructure/storage/s3-image-storage.adapter.js';

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => ({ RMU_MEDIA_S3_BUCKET: 'bucket', RMU_MEDIA_S3_REGION: 'eu-west-1' })[key],
  }) as unknown as ConfigService;

describe('S3ImageStorageAdapter width (spec 102)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scales chronicle images to RMU_MEDIA_CHRONICLE_MAX_WIDTH and the rest to RMU_MEDIA_IMAGE_MAX_WIDTH', () => {
    const adapter = new S3ImageStorageAdapter(config({ RMU_MEDIA_IMAGE_MAX_WIDTH: 100, RMU_MEDIA_CHRONICLE_MAX_WIDTH: 300 }));
    expect(adapter.maxWidthFor('chronicle')).toBe(300);
    expect(adapter.maxWidthFor('avatars')).toBe(100);
  });

  it('defaults to 2048 and 4096', () => {
    const adapter = new S3ImageStorageAdapter(config({}));
    expect(adapter.maxWidthFor('chronicle')).toBe(4096);
    expect(adapter.maxWidthFor('generic')).toBe(2048);
  });

  it('stores a chronicle image at its own width', async () => {
    vi.spyOn(S3Client.prototype, 'send').mockImplementation((() => Promise.resolve({})) as never);
    const adapter = new S3ImageStorageAdapter(config({ RMU_MEDIA_IMAGE_MAX_WIDTH: 50, RMU_MEDIA_CHRONICLE_MAX_WIDTH: 150 }));
    const content = await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .png()
      .toBuffer();
    const map = await adapter.store({ imageId: 'm', category: 'chronicle', content, contentType: 'image/png' });
    const avatar = await adapter.store({ imageId: 'a', category: 'avatars', content, contentType: 'image/png' });
    expect(map).toMatchObject({ width: 150, height: 75, storageKey: 'uploads/chronicle/m.png' });
    expect(avatar).toMatchObject({ width: 50, height: 25 });
  });
});
