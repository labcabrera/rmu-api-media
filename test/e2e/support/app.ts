import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import { configureHttp } from '../../../src/bootstrap/http.js';
import { configureOpenApi } from '../../../src/bootstrap/openapi.js';
import { AUDIENCE, ISSUER, LocalJwks } from './jwks.js';
import { LocalManifest } from './manifest.js';

export type Server = Parameters<typeof request>[0];

/** The users of the suite, by the Keycloak groups in their token. */
export const USERS = {
  admin: { sub: 'e2e-admin', groups: ['rmu-admin'] },
  owner: { sub: 'e2e-owner', groups: ['rmu-user'] },
  other: { sub: 'e2e-other', groups: ['rmu-user'] },
  noRole: { sub: 'e2e-guest', groups: [] as string[] },
} as const;

export type UserName = keyof typeof USERS;

export const BUCKET = 'rmu-e2e';
export const UPLOADS_PREFIX = 'uploads';
export const UPLOAD_MAX_BYTES = 200_000;

/** The S3 bucket of the suite: object key -> body and content type. */
export type Bucket = Map<string, { body: Buffer; contentType?: string }>;

export type E2eApp = {
  app: NestExpressApplication;
  server: Server;
  jwks: LocalJwks;
  /** The rmu-mfe-assets manifest the API reads its base images from. */
  manifest: LocalManifest;
  bucket: Bucket;
  auth: (user: UserName) => string;
  connection: Connection;
  stop: () => Promise<void>;
};

/** Answers the two S3 commands the storage adapter sends from an in-memory bucket. */
function fakeS3(bucket: Bucket) {
  const send = (command: unknown): Promise<unknown> => {
    if (command instanceof PutObjectCommand) {
      const input = command.input;
      bucket.set(input.Key!, { body: Buffer.from(input.Body as Uint8Array), contentType: input.ContentType });
      return Promise.resolve({});
    }
    if (command instanceof DeleteObjectCommand) {
      bucket.delete(command.input.Key!);
      return Promise.resolve({});
    }
    return Promise.reject(new Error(`Unexpected S3 command ${(command as object).constructor.name}`));
  };
  // `send` also has callback overloads; the adapter only uses the promise one.
  return vi.spyOn(S3Client.prototype, 'send').mockImplementation(send as never);
}

/**
 * Boots the whole AppModule as main.ts does (configureHttp, configureOpenApi) against an in-memory Mongo and a local JWKS.
 * The S3 client answers from an in-memory bucket, so uploads still go through sharp, and the base images come from a
 * local manifest server read again on every request (TTL 0).
 * AppModule is imported after setting the environment, because ConfigModule.forRoot() reads it when the module is
 * evaluated.
 */
export async function startApp(env: Record<string, string> = {}): Promise<E2eApp> {
  const mongo = await MongoMemoryServer.create();
  const jwks = new LocalJwks();
  await jwks.start();
  const manifest = new LocalManifest();
  await manifest.start();
  Object.assign(process.env, {
    RMU_MONGO_MEDIA_URI: mongo.getUri('rmu-media-e2e'),
    RMU_IAM_JWK_URI: jwks.uri,
    RMU_IAM_ISSUER_URI: ISSUER,
    RMU_IAM_AUDIENCE: AUDIENCE,
    RMU_MEDIA_S3_REGION: 'eu-west-1',
    RMU_MEDIA_S3_BUCKET: BUCKET,
    RMU_MEDIA_S3_UPLOADS_PREFIX: UPLOADS_PREFIX,
    RMU_MEDIA_UPLOAD_MAX_BYTES: String(UPLOAD_MAX_BYTES),
    RMU_MEDIA_BASE_MANIFEST_URI: manifest.uri,
    RMU_MEDIA_BASE_MANIFEST_TTL_MS: '0',
    RMU_MEDIA_IMAGE_MAX_WIDTH: '64',
    RMU_THROTTLE_LIMIT: '0',
    RMU_CORS_ORIGINS: '',
    ...env,
  });

  const bucket: Bucket = new Map();
  const s3 = fakeS3(bucket);
  const { AppModule } = await import('../../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureHttp(app);
  configureOpenApi(app);
  await app.init();

  return {
    app,
    server: app.getHttpServer() as Server,
    jwks,
    manifest,
    bucket,
    auth: user => `Bearer ${jwks.token(USERS[user])}`,
    connection: app.get<Connection>(getConnectionToken()),
    stop: async () => {
      await app.close();
      await jwks.stop();
      await manifest.stop();
      await mongo.stop();
      s3.mockRestore();
    },
  };
}

/** The ids of a page response. */
export const ids = (body: unknown) => (body as { content: { id: string }[] }).content.map(item => item.id);
