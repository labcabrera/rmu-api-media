# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project

NestJS 12 / TypeScript REST API for media (images) in RMU Online (Rolemaster Unified fan platform, see https://github.com/labcabrera/rmu-platform). Images are stored in S3 and their metadata in MongoDB. Default port 3011; Swagger UI at `/api-docs`, raw OpenAPI JSON at `/api-spec`.

It follows the platform and conventions of `rmu-api-core` (workspace spec 020): Node 24 (`nvm use`), pnpm 10 through corepack (`packageManager`), native ESM, SWC build, Vitest. Core's README (*Project layout*, *HTTP contract*, *API template*) is the reference.

## Commands

```bash
pnpm start:dev           # watch mode (needs .env, see below)
pnpm build               # SWC build -> dist/ (no type check)
pnpm typecheck           # tsc --noEmit
pnpm lint                # typed ESLint + Prettier over src/test (pnpm lint:fix to fix)
pnpm format              # prettier (singleQuote, printWidth 140, arrowParens avoid)
pnpm test                # unit tests (test/unit)
pnpm test:e2e            # test/e2e: AppModule on mongodb-memory-server, local JWKS, in-memory S3 (test/e2e/support)
pnpm test:cov            # unit + e2e with the coverage thresholds of vitest.config.ts (what CI runs)
pnpm exec vitest run <file>          # single test file
pnpm exec vitest run -t "test name"  # single test by name
make check               # lint, typecheck, unit and e2e
make docker-run          # build image and run on docker network `rmu-network` using .env.docker
make create-release      # semantic-release based release (see below)
```

## Configuration

`ConfigModule` loads `.env` and validates it with the Joi schema in `src/config/env.schema.ts` — the app fails at startup if required vars are missing. Two templates, both expecting the infrastructure started from `rmu-platform`:

- `.env.example` → `.env`: running on the host (`pnpm start:dev`) with `COMPOSE_PROFILES=infrastructure`. Everything is `localhost`.
- `.env.docker.example` → `.env.docker`: `make docker-run` on the `rmu-network` Docker network. Uses in-network hostnames (`rmu-mongo`, `rmu-keycloak:8080`).

In the full Compose stack (`infrastructure,apis`) neither file is used: `rmu-platform/compose/apis.yaml` injects the environment.

Required: Mongo URI (`RMU_MONGO_MEDIA_URI`), Keycloak JWT validation (`RMU_IAM_JWK_URI`, `RMU_IAM_ISSUER_URI`, `RMU_IAM_AUDIENCE`), S3 (`RMU_MEDIA_S3_REGION`, `RMU_MEDIA_S3_BUCKET`; optional `RMU_MEDIA_S3_UPLOADS_PREFIX` (default `uploads`), `RMU_MEDIA_S3_ENDPOINT`, `RMU_MEDIA_S3_FORCE_PATH_STYLE`, credentials), the manifest of the base images (`RMU_MEDIA_BASE_MANIFEST_URI`, e.g. `http://rmu-mfe-assets/images/manifest.json`; optional `RMU_MEDIA_BASE_MANIFEST_TTL_MS`, default 60000) and the upload limit (`RMU_MEDIA_UPLOAD_MAX_BYTES`, default 10485760). media uses no Kafka: it publishes and consumes no events (spec 021, decision 12). Optional HTTP settings: `RMU_CORS_ORIGINS`, `RMU_THROTTLE_LIMIT`, `RMU_THROTTLE_TTL_MS`, `RMU_TRUST_PROXY`, `LOG_LEVEL`. Add any new env var to that schema.

## Architecture

Hexagonal / DDD layout with NestJS CQRS. Each feature module under `src/modules/<feature>/` is split into:

- `domain/` — aggregates (extend the shared `BaseAggregateRoot`, which holds the `id` and the stored `version`; private constructor, `create()` generates a UUID, `fromProps()` rehydrates, `getProps()` for persistence) and value types.
- `application/` — `cqrs/commands`, `cqrs/queries`, `cqrs/handlers` (one handler per file), and `ports/` (`*.port.ts`, each exporting its interface and a `Symbol` DI token such as `IMAGE_REPOSITORY`). Commands carry `userId` and `roles` from the JWT.
- `infrastructure/` — adapters implementing ports (`db/` Mongo repositories, `persistence/models`, `storage/` S3).
- `interfaces/http/` — controllers and DTOs (`dto/`). DTOs own the mapping: static `toCommand(...)` on request DTOs and `fromEntity(...)` on response DTOs. Controllers take the user with `@CurrentUser()`, document errors with `@ApiErrors({...})` and only talk to `CommandBus`/`QueryBus`.

Modules:
- `shared` — `infrastructure/security` (`AuthModule`, Passport JWT strategy validating RS256 tokens against `RMU_IAM_JWK_URI` with issuer and audience checks, `JwtAuthGuard`, `BaseEntityGuard`, which `ImageGuardAdapter` applies to images), `MongoBaseRepository` (RSQL search with paging, `update(entity)` conditional on `version`), the RSQL parser, the `DomainError` hierarchy mapped by the global `HttpExceptionFilter` to `{ statusCode, error, code, message, timestamp, path }`, `PagedQueryDto` (`size` ≤ 100), throttler guard and health controller.
- `images` — permissions (spec 021, decision 2; `IMAGE_GUARD`): any authenticated user lists and reads images, `rmu-user` or `rmu-admin` uploads, the owner or `rmu-admin` changes and deletes. Upload, list (RSQL), read by id, update (metadata and/or file, optional `version` → 409 `version-conflict` when stale) and delete. The bulk import of existing S3 objects was removed in spec 057.
- `stats` — counts for the admin dashboard, read from the `images` collection: user images only (base images are not in Mongo).

Two sources of images (spec 057):
- **Base images** are the files of rmu-mfe-assets. `BASE_IMAGE_CATALOG` (`HttpBaseImageCatalogAdapter`) reads its `images/manifest.json` from `RMU_MEDIA_BASE_MANIFEST_URI`, keeps it in memory and asks again at most once per `RMU_MEDIA_BASE_MANIFEST_TTL_MS` with `If-None-Match` (a 304 keeps the copy). When the manifest fails it keeps the last good copy (warning; retried after 5 s at most), and with none the listing only has user images. They are not in Mongo: id `base:<path>` (`base:images/races/x.png`, URL-encoded in a path: `/v1/images/base%3Aimages%2Fraces%2Fx.png`), `url` = path, `owner` null, `verified` true, `version` 0. `PATCH`/`DELETE` on a `base:` id is a 403 `base-image-read-only` (`BaseImageReadOnlyError`), even for an admin.
- **User images** are uploads, in Mongo (`rmu-media.images`) and S3. They carry `visibility` (`public` | `friends` | `private`; only `public` is accepted for now, the others are reserved; documents without it are public).
- `ImageDto` has `source: 'base' | 'user'` and `visibility`. `GET /v1/images` lists the base images first, sorted by path, then the user images sorted by id; a page is a window of that sequence (it can hold the last base images and the first user ones) and `totalElements` counts both. The RSQL `q` applies to both: in memory on the base entries (`rsql-matcher.ts`, with the semantics of the Mongo filter: `==`, `!=`, `<`, `<=`, `>`, `>=`, `=in=`, `=out=`, `=re=`, `;`, `,`, over `id`, `source`, `visibility`, `category`, `url`, `storageKey`, `path`, `contentType`, `sizeBytes`, `width`, `height`, `sha256`, `verified`, `owner`), and in Mongo on the user ones, where `source` comparisons are decided before the query (`bindSelectors`).

`src/main.ts` is short: `src/bootstrap/` sets the HTTP layer (helmet, CORS, `trust proxy`, validation), the logger levels and OpenAPI.

Image storage details (`S3ImageStorageAdapter`):
- Uploads are processed with `sharp`: auto-rotate, resized to `RMU_MEDIA_IMAGE_MAX_WIDTH` (no enlargement), re-encoded as PNG if input is PNG, otherwise JPEG q85.
- Only PNG, JPEG and WebP: the declared type is checked by the controller and the content by sharp (400 `validation` otherwise). A file larger than `RMU_MEDIA_UPLOAD_MAX_BYTES` is a 413 `payload-too-large` (the `MulterModule` limits of `ImagesModule`).
- Storage key, S3 object key and `url` are the same: `<RMU_MEDIA_S3_UPLOADS_PREFIX>/<category>/<imageId>.<png|jpg>` (`uploads/avatars/<uuid>.png`), never under the files of rmu-mfe-assets. Entities store that path and the frontends resolve `uploads/...` against `RMU_MFE_MEDIA_URI`; no public host is stored. `RMU_MEDIA_S3_ENDPOINT` + `FORCE_PATH_STYLE` support S3-compatible stores.
- The adapter only deletes objects under the uploads prefix: images of the layout before spec 057 (`images/<category>/...` under the assets prefix) keep their object until `scripts/move-uploads.mjs` moves them.
- The storage key is fixed when the file is uploaded: changing the category of an image only changes its metadata, and the object stays under the folder of the old category (a new file is stored under the current category).


## Imports and style

ESM: relative imports ending in `.js` (`import { X } from '../shared/x.js'`), `import type` for type-only imports (`verbatimModuleSyntax`). Files are kebab-case with role suffixes (`*.command.ts`, `*.handler.ts`, `*.dto.ts`, `*.port.ts`, `mongo.*.repository.ts`). SWC gotchas: give `@Prop`/`@ApiProperty` an explicit `type` for string-union aliases and nullable fields, and never use a bare `@Inject()`.

Problems found while migrating to the template (spec 020) are in the workspace `docs/reports/api-template-rollout-findings.md`; tests that expose an open one are `it.skip('… [F-media-NN]')`.

## Commits and releases

Commit messages must follow Conventional Commits (`feat:`, `fix:`, `chore:`, ...); a husky `commit-msg` hook runs commitlint (`commitlint.config.cjs`) and rejects anything else.

`make create-release` (non-interactive, run from a clean `develop`) merges `develop` into `master` with `--no-ff` and runs semantic-release (`release.config.cjs`). semantic-release works out the version from the commits since the last tag: a breaking change bumps major, `feat` bumps minor, anything else bumps patch. `RELEASE_BUMP=patch|minor|major` forces the bump. It updates `package.json`/`CHANGELOG.md`, commits `chore(release): X.Y.Z`, tags `X.Y.Z` (no `v` prefix) and pushes `master` plus the tag. It does not publish to npm or create a GitHub release. The target then merges `master` back into `develop`, sets the version to `X.Y.(Z+1)-SNAPSHOT` and pushes `develop`. If no release is produced, local `master` is reset to the remote and the target fails.
