import { Image } from '../../../../src/modules/images/domain/aggregates/image.js';
import type { ImageProps } from '../../../../src/modules/images/domain/aggregates/image-props.js';

const props = (): ImageProps => ({
  id: 'image-1',
  category: 'avatars',
  storageKey: 'images/avatars/image-1.png',
  url: 'images/avatars/image-1.png',
  contentType: 'image/png',
  sizeBytes: 10,
  altText: 'Alt',
  verified: false,
  visibility: 'public',
  owner: 'owner',
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('BaseAggregateRoot', () => {
  it('has changes when it was never stored', () => {
    const image = Image.create({ ...props(), storageKey: '', url: '' });
    expect(image.hasChanges()).toBe(true);
  });

  it('has no changes after loading, even when only updatedAt moves [F-receta-23]', () => {
    const image = Image.fromProps(props()).restoreVersion(3);
    image.updateMetadata({ altText: 'Alt', category: 'avatars' });
    expect(image.updatedAt).toBeInstanceOf(Date);
    expect(image.hasChanges()).toBe(false);
  });

  it('has changes once a field differs from the loaded state', () => {
    const image = Image.fromProps(props()).restoreVersion(0);
    image.updateMetadata({ altText: 'Changed' });
    expect(image.hasChanges()).toBe(true);
  });

  it('takes a new snapshot when the repository restores the version after a write', () => {
    const image = Image.fromProps(props()).restoreVersion(0);
    image.markVerified();
    expect(image.hasChanges()).toBe(true);
    image.restoreVersion(1);
    expect(image.hasChanges()).toBe(false);
    expect(image.version).toBe(1);
  });

  it('keeps the version out of the serialized aggregate [F-receta-27]', () => {
    const image = Image.fromProps(props()).restoreVersion(5);
    const json = JSON.parse(JSON.stringify(image)) as Record<string, unknown>;
    expect(json).not.toHaveProperty('storedVersion');
    expect(Object.values(json)).not.toContain(5);
    expect(image.version).toBe(5);
  });

  it('rejects a stale version with version-conflict', () => {
    const image = Image.fromProps(props()).restoreVersion(2);
    expect(() => image.checkVersion(1)).toThrow(expect.objectContaining({ code: 'version-conflict', statusCode: 409 }));
    expect(() => image.checkVersion(2)).not.toThrow();
    expect(() => image.checkVersion(undefined)).not.toThrow();
  });
});
