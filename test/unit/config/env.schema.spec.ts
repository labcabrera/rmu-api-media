import { envSchema } from '../../../src/config/env.schema.js';

const required = {
  RMU_MONGO_MEDIA_URI: 'mongodb://localhost:27017/rmu-media',
  RMU_IAM_JWK_URI: 'http://localhost:8090/sso/realms/rmu/protocol/openid-connect/certs',
  RMU_IAM_ISSUER_URI: 'http://localhost/sso/realms/rmu',
  RMU_IAM_AUDIENCE: 'rmu-api',
  RMU_MEDIA_S3_REGION: 'eu-west-1',
  RMU_MEDIA_S3_BUCKET: 'rmu-e2e',
  RMU_MEDIA_BASE_MANIFEST_URI: 'http://rmu-mfe-assets/images/manifest.json',
};

describe('envSchema', () => {
  it('starts without any Kafka variable [F-media-12]', () => {
    const result = envSchema.validate(required);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.value as object).some(key => key.startsWith('RMU_KAFKA_'))).toBe(false);
  });

  it('defaults the uploads prefix, the upload limit and the manifest TTL (spec 057)', () => {
    expect(envSchema.validate(required).value).toMatchObject({
      RMU_MEDIA_S3_UPLOADS_PREFIX: 'uploads',
      RMU_MEDIA_UPLOAD_MAX_BYTES: 10_485_760,
      RMU_MEDIA_BASE_MANIFEST_TTL_MS: 60_000,
    });
  });

  it('requires the manifest of the base images', () => {
    expect(envSchema.validate({ ...required, RMU_MEDIA_BASE_MANIFEST_URI: undefined }).error?.message).toContain(
      'RMU_MEDIA_BASE_MANIFEST_URI',
    );
  });

  it.each(['/uploads', 'uploads/', 'up loads', ''])('rejects the uploads prefix %j', prefix => {
    expect(envSchema.validate({ ...required, RMU_MEDIA_S3_UPLOADS_PREFIX: prefix }).error).toBeDefined();
  });

  it('accepts a nested uploads prefix', () => {
    expect(envSchema.validate({ ...required, RMU_MEDIA_S3_UPLOADS_PREFIX: 'media/uploads' }).error).toBeUndefined();
  });
});
