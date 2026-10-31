import Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().positive().default(3011),
  LOG_LEVEL: Joi.string().default('info'),
  RMU_MONGO_MEDIA_URI: Joi.string().required(),
  RMU_IAM_URI: Joi.string().uri().default('http://localhost/sso'),
  RMU_IAM_REALM: Joi.string().default('rmu'),
  RMU_IAM_JWK_URI: Joi.string().uri().required(),
  RMU_IAM_ISSUER_URI: Joi.string().uri().required(),
  RMU_IAM_AUDIENCE: Joi.string().required(),
  // HTTP hardening, as in rmu-api-core. No origins: CORS stays off, as the browser comes through the gateway.
  RMU_CORS_ORIGINS: Joi.string().allow('').default(''),
  RMU_THROTTLE_LIMIT: Joi.number().integer().min(0).default(300),
  RMU_THROTTLE_TTL_MS: Joi.number().integer().min(1).default(60_000),
  RMU_TRUST_PROXY: Joi.string().default('loopback, linklocal, uniquelocal'),
  RMU_MEDIA_S3_REGION: Joi.string().required(),
  RMU_MEDIA_S3_BUCKET: Joi.string().required(),
  // Uploads go to <prefix>/<category>/<id>.<ext>, outside the files of rmu-mfe-assets (spec 057, decision 3).
  RMU_MEDIA_S3_UPLOADS_PREFIX: Joi.string()
    .pattern(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/)
    .default('uploads'),
  RMU_MEDIA_S3_ENDPOINT: Joi.string().uri().optional(),
  RMU_MEDIA_S3_ACCESS_KEY_ID: Joi.string().optional(),
  RMU_MEDIA_S3_SECRET_ACCESS_KEY: Joi.string().optional(),
  RMU_MEDIA_S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
  RMU_MEDIA_IMAGE_MAX_WIDTH: Joi.number().integer().min(1).default(2048),
  // Largest upload; a larger file is a 413 (spec 057, decision 9).
  RMU_MEDIA_UPLOAD_MAX_BYTES: Joi.number().integer().min(1).default(10_485_760),
  // Manifest of the base images of rmu-mfe-assets (spec 057, decision 2), read again at most once per TTL.
  RMU_MEDIA_BASE_MANIFEST_URI: Joi.string().uri().required(),
  RMU_MEDIA_BASE_MANIFEST_TTL_MS: Joi.number().integer().min(0).default(60_000),
});
