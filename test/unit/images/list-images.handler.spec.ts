import { ListImagesHandler } from '../../../src/modules/images/application/cqrs/handlers/list-images.handler.js';
import { GetImageHandler } from '../../../src/modules/images/application/cqrs/handlers/get-image.handler.js';
import { DeleteImageHandler } from '../../../src/modules/images/application/cqrs/handlers/delete-image.handler.js';
import { UpdateImageHandler } from '../../../src/modules/images/application/cqrs/handlers/update-image.handler.js';
import { ListImagesQuery } from '../../../src/modules/images/application/cqrs/queries/list-images.query.js';
import { GetImageQuery } from '../../../src/modules/images/application/cqrs/queries/get-image.query.js';
import { DeleteImageCommand } from '../../../src/modules/images/application/cqrs/commands/delete-image.command.js';
import { UpdateImageCommand } from '../../../src/modules/images/application/cqrs/commands/update-image.command.js';
import type { BaseImageCatalogPort } from '../../../src/modules/images/application/ports/base-image-catalog.port.js';
import type { ImageRepository } from '../../../src/modules/images/application/ports/image-repository.port.js';
import type { ImageStoragePort } from '../../../src/modules/images/application/ports/image-storage.port.js';
import type { ImageGuardPort } from '../../../src/modules/images/application/ports/image-guard.port.js';
import { Image } from '../../../src/modules/images/domain/aggregates/image.js';
import { BaseImage } from '../../../src/modules/images/domain/entities/base-image.js';
import { ImageDto } from '../../../src/modules/images/interfaces/http/dto/image.dto.js';

const base = (path: string) =>
  new BaseImage({ path, category: path.split('/')[1], contentType: 'image/png', sizeBytes: 1, width: null, height: 10, sha256: 'x' });

const user = (id: string) =>
  Image.fromProps({
    id,
    category: 'avatars',
    storageKey: `uploads/avatars/${id}.png`,
    url: `uploads/avatars/${id}.png`,
    contentType: 'image/png',
    sizeBytes: 1,
    verified: false,
    visibility: 'public',
    owner: 'owner',
    createdAt: new Date(),
  });

const BASE = ['images/a.png', 'images/b.png', 'images/c.png'].map(base);
const USERS = ['u1', 'u2', 'u3', 'u4'].map(user);

/** A repository over USERS that honours skip and limit as Mongo does (limit 0 only counts). */
const repository = () => {
  const findSlice = vi.fn((_rsql: string, skip: number, limit: number) =>
    Promise.resolve({ content: limit > 0 ? USERS.slice(skip, skip + limit) : [], totalElements: USERS.length }),
  );
  const findById = vi.fn((id: string) => Promise.resolve(USERS.find(image => image.id === id) ?? null));
  return { repo: { findSlice, findById } as unknown as ImageRepository, findSlice, findById };
};

const catalog = (images = BASE) =>
  ({
    search: vi.fn(() => Promise.resolve(images)),
    findByPath: vi.fn((path: string) => Promise.resolve(images.find(image => image.path === path) ?? null)),
  }) as unknown as BaseImageCatalogPort;

const ids = (content: { id: string }[]) => content.map(image => image.id);

describe('ListImagesHandler', () => {
  const run = async (page: number, size: number, images = BASE) => {
    const { repo, findSlice } = repository();
    const handler = new ListImagesHandler(repo, catalog(images));
    const result = await handler.execute(new ListImagesQuery('category==x', page, size, 'user', []));
    return { result, findSlice };
  };

  it('gives a page of base images only, and still counts the user images', async () => {
    const { result, findSlice } = await run(0, 2);
    expect(ids(result.content)).toEqual(['base:images/a.png', 'base:images/b.png']);
    expect(findSlice).toHaveBeenCalledWith('category==x', 0, 0);
    expect(result.pagination).toEqual({ page: 0, size: 2, totalElements: 7, totalPages: 4 });
  });

  it('fills the page across the boundary', async () => {
    const { result, findSlice } = await run(1, 2);
    expect(ids(result.content)).toEqual(['base:images/c.png', 'u1']);
    expect(findSlice).toHaveBeenCalledWith('category==x', 0, 1);
  });

  it('skips the user images of the earlier pages after the base ones', async () => {
    const { result, findSlice } = await run(2, 2);
    expect(ids(result.content)).toEqual(['u2', 'u3']);
    expect(findSlice).toHaveBeenCalledWith('category==x', 1, 2);
    expect(ids((await run(3, 2)).result.content)).toEqual(['u4']);
    expect((await run(4, 2)).result.content).toEqual([]);
  });

  it('lists only the user images when there are no base images', async () => {
    const { result } = await run(0, 3, []);
    expect(ids(result.content)).toEqual(['u1', 'u2', 'u3']);
    expect(result.pagination.totalElements).toBe(4);
  });

  it('maps both kinds to the same DTO', async () => {
    const { result } = await run(1, 2);
    expect(result.content.map(view => ImageDto.fromView(view))).toEqual([
      expect.objectContaining({
        id: 'base:images/c.png',
        source: 'base',
        visibility: 'public',
        owner: null,
        url: 'images/c.png',
        storageKey: 'images/c.png',
        verified: true,
        width: undefined,
        height: 10,
        version: 0,
      }),
      expect.objectContaining({ id: 'u1', source: 'user', visibility: 'public', owner: 'owner', url: 'uploads/avatars/u1.png' }),
    ]);
  });
});

describe('GetImageHandler', () => {
  const handler = new GetImageHandler(repository().repo, catalog());

  it('reads a base image by its id and a user image by its own', async () => {
    expect((await handler.execute(new GetImageQuery('base:images/b.png', 'user', []))).id).toBe('base:images/b.png');
    expect((await handler.execute(new GetImageQuery('u2', 'user', []))).id).toBe('u2');
  });

  it.each(['base:images/none.png', 'none'])('answers not found to %s', async id => {
    await expect(handler.execute(new GetImageQuery(id, 'user', []))).rejects.toMatchObject({ statusCode: 404, code: 'not-found' });
  });
});

describe('base images are read-only', () => {
  const readOnly = { statusCode: 403, code: 'base-image-read-only', name: 'BaseImageReadOnlyError' };
  const store = vi.fn();
  const remove = vi.fn();
  const storage = { store, delete: remove } as unknown as ImageStoragePort;
  const guard = { checkCreate: vi.fn(), checkUpdate: vi.fn(), checkDelete: vi.fn() } as unknown as ImageGuardPort;

  it('rejects a change, even from an administrator', async () => {
    const { repo, findById } = repository();
    const handler = new UpdateImageHandler(repo, storage, guard);
    const command = new UpdateImageCommand(
      'base:images/a.png',
      undefined,
      Buffer.from('x'),
      'image/png',
      'x.png',
      'Alt',
      undefined,
      'admin',
      ['rmu-admin'],
    );
    await expect(handler.execute(command)).rejects.toMatchObject(readOnly);
    expect(findById).not.toHaveBeenCalled();
    expect(store).not.toHaveBeenCalled();
  });

  it('rejects a deletion, even from an administrator', async () => {
    const handler = new DeleteImageHandler(repository().repo, storage, guard);
    await expect(handler.execute(new DeleteImageCommand('base:images/a.png', 'admin', ['rmu-admin']))).rejects.toMatchObject(readOnly);
    expect(remove).not.toHaveBeenCalled();
  });
});
