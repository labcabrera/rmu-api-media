import { DeleteImagesByScopeCommand } from '../../../src/modules/images/application/cqrs/commands/delete-images-by-scope.command.js';
import { UploadImageCommand } from '../../../src/modules/images/application/cqrs/commands/upload-image.command.js';
import { DeleteImagesByScopeHandler } from '../../../src/modules/images/application/cqrs/handlers/delete-images-by-scope.handler.js';
import { UploadImageHandler } from '../../../src/modules/images/application/cqrs/handlers/upload-image.handler.js';
import type { ImageRepository } from '../../../src/modules/images/application/ports/image-repository.port.js';
import type { ImageStoragePort } from '../../../src/modules/images/application/ports/image-storage.port.js';
import { Image } from '../../../src/modules/images/domain/aggregates/image.js';
import { BaseImage } from '../../../src/modules/images/domain/entities/base-image.js';
import { parseImageScope } from '../../../src/modules/images/domain/entities/image-scope.js';
import { ImageGuardAdapter } from '../../../src/modules/images/infrastructure/security/image-guard.adapter.js';
import { matchesRsql } from '../../../src/modules/shared/infrastructure/db/rsql-matcher.js';
import { RsqlParser } from '../../../src/modules/shared/infrastructure/db/rsql-parser.js';

const GAME = '0b7c1f9e-1234-4abc-8def-000000000001';
const SCOPE = `strategic-game:${GAME}`;
const invalidScope = { statusCode: 400, code: 'invalid-image-scope' };

const image = (id: string) =>
  Image.fromProps({
    id,
    category: 'chronicle',
    storageKey: `uploads/chronicle/${id}.png`,
    url: `uploads/chronicle/${id}.png`,
    contentType: 'image/png',
    sizeBytes: 1,
    verified: false,
    visibility: 'public',
    scope: SCOPE,
    owner: 'owner',
    createdAt: new Date(),
  });

describe('parseImageScope (spec 102)', () => {
  it('accepts a strategic game with a uuid', () => {
    expect(parseImageScope(SCOPE)).toBe(SCOPE);
    expect(parseImageScope(SCOPE.toUpperCase().replace('STRATEGIC-GAME', 'strategic-game'))).toBeDefined();
  });

  it.each([
    undefined,
    null,
    '',
    'strategic-game',
    'strategic-game:',
    'strategic-game:not-a-uuid',
    `tactical-game:${GAME}`,
    GAME,
    `strategic-game:${GAME}:extra`,
    ` strategic-game:${GAME}`,
  ])('rejects %j with invalid-image-scope', value => {
    expect(() => parseImageScope(value)).toThrow(expect.objectContaining(invalidScope));
  });
});

describe('scope of the base images', () => {
  const parser = new RsqlParser();
  const record = new BaseImage({
    path: 'images/races/elf.png',
    category: 'races',
    contentType: 'image/png',
    sizeBytes: 1,
    width: 1,
    height: 1,
    sha256: 'x',
  }).toSearchRecord();

  it('never match a scope, as they have none', () => {
    expect(matchesRsql(parser.parseExpression(`scope==${SCOPE}`)!, record)).toBe(false);
    expect(matchesRsql(parser.parseExpression(`scope=in=(${SCOPE})`)!, record)).toBe(false);
    expect(matchesRsql(parser.parseExpression('scope==null')!, record)).toBe(true);
  });
});

describe('UploadImageHandler scope', () => {
  const setup = () => {
    const repository = { save: vi.fn((entity: Image) => Promise.resolve(entity)) } as unknown as ImageRepository;
    const store = vi.fn(() =>
      Promise.resolve({ storageKey: 'uploads/chronicle/x.png', url: 'uploads/chronicle/x.png', contentType: 'image/png', sizeBytes: 1 }),
    );
    const storage: ImageStoragePort = { store, delete: vi.fn() };
    return { handler: new UploadImageHandler(repository, storage, new ImageGuardAdapter()), store };
  };
  const command = (scope?: string) =>
    new UploadImageCommand(
      'chronicle',
      Buffer.from('x'),
      'image/png',
      'map.png',
      undefined,
      undefined,
      'owner',
      ['rmu-user'],
      'public',
      scope,
    );

  it('stores the scope of the image', async () => {
    const { handler } = setup();
    expect((await handler.execute(command(SCOPE))).scope).toBe(SCOPE);
    expect((await handler.execute(command())).scope).toBeUndefined();
  });

  it('rejects an invalid scope before storing the file', async () => {
    const { handler, store } = setup();
    await expect(handler.execute(command('campaign:1'))).rejects.toMatchObject(invalidScope);
    expect(store).not.toHaveBeenCalled();
  });
});

describe('DeleteImagesByScopeHandler', () => {
  const setup = (images: Image[]) => {
    const findAllByScope = vi.fn(() => Promise.resolve(images));
    const deleteByIds = vi.fn((ids: string[]) => Promise.resolve(ids.length));
    const remove = vi.fn(() => Promise.resolve());
    const repository = { findAllByScope, deleteByIds } as unknown as ImageRepository;
    const storage: ImageStoragePort = { store: vi.fn(), delete: remove };
    return { handler: new DeleteImagesByScopeHandler(repository, storage, new ImageGuardAdapter()), findAllByScope, deleteByIds, remove };
  };

  it('deletes the documents and the objects of the scope', async () => {
    const { handler, findAllByScope, deleteByIds, remove } = setup([image('a'), image('b')]);
    await expect(handler.execute(new DeleteImagesByScopeCommand(SCOPE, 'service', ['rmu-admin']))).resolves.toEqual({ deleted: 2 });
    expect(findAllByScope).toHaveBeenCalledWith(SCOPE);
    expect(deleteByIds).toHaveBeenCalledWith(['a', 'b']);
    expect(remove).toHaveBeenCalledWith('uploads/chronicle/a.png');
    expect(remove).toHaveBeenCalledWith('uploads/chronicle/b.png');
  });

  it('answers 0 for a scope without images', async () => {
    const { handler, deleteByIds } = setup([]);
    await expect(handler.execute(new DeleteImagesByScopeCommand(SCOPE, 'service', ['rmu-admin']))).resolves.toEqual({ deleted: 0 });
    expect(deleteByIds).not.toHaveBeenCalled();
  });

  it('only lets an admin in, before looking at the scope', async () => {
    const { handler, findAllByScope } = setup([image('a')]);
    await expect(handler.execute(new DeleteImagesByScopeCommand(undefined, 'owner', ['rmu-user']))).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(findAllByScope).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'strategic-game:1'])('rejects the scope %j', async scope => {
    const { handler } = setup([]);
    await expect(handler.execute(new DeleteImagesByScopeCommand(scope, 'service', ['rmu-admin']))).rejects.toMatchObject(invalidScope);
  });
});
