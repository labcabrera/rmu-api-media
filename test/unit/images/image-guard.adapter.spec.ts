import { ImageGuardAdapter } from '../../../src/modules/images/infrastructure/security/image-guard.adapter.js';
import type { Image } from '../../../src/modules/images/domain/aggregates/image.js';
import type { ImageImportTask } from '../../../src/modules/images/domain/aggregates/image-import-task.js';

const guard = new ImageGuardAdapter();
const image = { owner: 'owner' } as Image;
const task = { owner: 'admin' } as ImageImportTask;
const forbidden = { statusCode: 403, code: 'forbidden' };

describe('ImageGuardAdapter [F-media-06]', () => {
  it('lets rmu-user and rmu-admin upload, nobody else', () => {
    expect(() => guard.checkCreate(['rmu-user'])).not.toThrow();
    expect(() => guard.checkCreate(['rmu-admin'])).not.toThrow();
    expect(() => guard.checkCreate([])).toThrow(expect.objectContaining(forbidden));
  });

  it('lets the owner and an admin change or delete an image', () => {
    for (const check of [guard.checkUpdate.bind(guard), guard.checkDelete.bind(guard)]) {
      expect(() => check(image, 'owner', [])).not.toThrow();
      expect(() => check(image, 'someone', ['rmu-admin'])).not.toThrow();
      expect(() => check(image, 'someone', ['rmu-user'])).toThrow(expect.objectContaining(forbidden));
    }
  });

  it('lets only an admin import', () => {
    expect(() => guard.checkImport(['rmu-admin'])).not.toThrow();
    expect(() => guard.checkImport(['rmu-user'])).toThrow(expect.objectContaining(forbidden));
  });

  it('lets the user that started an import task and an admin read it', () => {
    expect(() => guard.checkReadTask(task, 'admin', [])).not.toThrow();
    expect(() => guard.checkReadTask(task, 'someone', ['rmu-admin'])).not.toThrow();
    expect(() => guard.checkReadTask(task, 'someone', ['rmu-user'])).toThrow(expect.objectContaining(forbidden));
  });
});
