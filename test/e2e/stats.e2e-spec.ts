import request from 'supertest';
import type { MediaStats } from '../../src/modules/stats/domain/media-stats.js';
import { startApp, type E2eApp } from './support/app.js';

const NOW = new Date();
const monthsAgo = (months: number) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - months, 2));
const month = (date: Date) => date.toISOString().slice(0, 7);

let e2e: E2eApp;

beforeAll(async () => {
  e2e = await startApp();
  await e2e.connection.collection('images').insertMany([
    // Distinct storage keys: the unique index on storageKey may already exist when they are inserted.
    { name: 'a', storageKey: 'uploads/avatars/a.png', sizeBytes: 100, createdAt: NOW },
    { name: 'b', storageKey: 'uploads/avatars/b.png', sizeBytes: 250, createdAt: monthsAgo(2) },
  ]);
});

afterAll(async () => {
  await e2e?.stop();
});

const stats = (body: unknown) => body as MediaStats;

describe('GET /v1/stats (spec 053)', () => {
  it('counts by status and by month of creation for an administrator', async () => {
    const response = await request(e2e.server).get('/v1/stats').set('Authorization', e2e.auth('admin'));
    expect(response.status).toBe(200);
    const body = stats(response.body);
    expect(body.images).toMatchObject({ total: 2, sizeBytes: 350 });
    expect(body.images.createdByMonth).toHaveLength(12);
    expect(body.images.createdByMonth.at(-1)).toEqual({ month: month(NOW), count: 1 });
    expect(body.images.createdByMonth.find(entry => entry.month === month(monthsAgo(2)))?.count).toBe(1);
  });

  it('is forbidden to a user who is not an administrator', async () => {
    const response = await request(e2e.server).get('/v1/stats').set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(403);
  });

  it('requires a token', async () => {
    expect((await request(e2e.server).get('/v1/stats')).status).toBe(401);
  });
});
