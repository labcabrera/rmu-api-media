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

- `.env.example` → `.env`: running on the host (`pnpm start:dev`) with `COMPOSE_PROFILES=infrastructure`. Everything is `localhost`; Kafka is `localhost:9093` (the `PLAINTEXT_HOST` listener). `localhost:9092` looks like it works but the broker then advertises `rmu-kafka-broker:9092`, which the host cannot resolve.
- `.env.docker.example` → `.env.docker`: `make docker-run` on the `rmu-network` Docker network. Uses in-network hostnames (`rmu-mongo`, `rmu-keycloak:8080`, `rmu-kafka-broker:9092`).

In the full Compose stack (`infrastructure,apis`) neither file is used: `rmu-platform/compose/apis.yaml` injects the environment.

Required: Mongo URI (`RMU_MONGO_MEDIA_URI`), Keycloak JWT validation (`RMU_IAM_JWK_URI`, `RMU_IAM_ISSUER_URI`, `RMU_IAM_AUDIENCE`), Kafka (`RMU_KAFKA_*`), S3 (`RMU_MEDIA_S3_REGION`, `RMU_MEDIA_S3_BUCKET`). Optional HTTP settings: `RMU_CORS_ORIGINS`, `RMU_THROTTLE_LIMIT`, `RMU_THROTTLE_TTL_MS`, `RMU_TRUST_PROXY`, `LOG_LEVEL`. Add any new env var to that schema.

## Architecture

Hexagonal / DDD layout with NestJS CQRS. Each feature module under `src/modules/<feature>/` is split into:

- `domain/` — aggregates (extend the shared `BaseAggregateRoot`, which holds the `id` and the stored `version`; private constructor, `create()` generates a UUID, `fromProps()` rehydrates, `getProps()` for persistence) and value types.
- `application/` — `cqrs/commands`, `cqrs/queries`, `cqrs/handlers` (one handler per file), and `ports/` (`*.port.ts`, each exporting its interface and a `Symbol` DI token such as `IMAGE_REPOSITORY`). Commands carry `userId` and `roles` from the JWT.
- `infrastructure/` — adapters implementing ports (`db/` Mongo repositories, `persistence/models`, `storage/` S3).
- `interfaces/http/` — controllers and DTOs (`dto/`). DTOs own the mapping: static `toCommand(...)` on request DTOs and `fromEntity(...)` on response DTOs. Controllers take the user with `@CurrentUser()`, document errors with `@ApiErrors({...})` and only talk to `CommandBus`/`QueryBus`.

Modules:
- `shared` — `infrastructure/security` (`AuthModule`, Passport JWT strategy validating RS256 tokens against `RMU_IAM_JWK_URI` with issuer and audience checks, `JwtAuthGuard`, `BaseEntityGuard`, which `ImageGuardAdapter` applies to images), `MongoBaseRepository` (RSQL search with paging, `update(entity)` conditional on `version`), the RSQL parser, the `DomainError` hierarchy mapped by the global `HttpExceptionFilter` to `{ statusCode, error, code, message, timestamp, path }`, `PagedQueryDto` (`size` ≤ 100), throttler guard, Kafka producer and health controller.
- `images` — permissions (spec 021, decision 2; `IMAGE_GUARD`): any authenticated user lists images, `rmu-user` or `rmu-admin` uploads, the owner or `rmu-admin` changes and deletes, only `rmu-admin` imports from S3 and reads the import tasks of others. Upload, list (RSQL), update (metadata and/or file, optional `version` → 409 `version-conflict` when stale), delete, and bulk import of existing S3 objects.

`src/main.ts` is short: `src/bootstrap/` sets the HTTP layer (helmet, CORS, `trust proxy`, validation), the logger levels and OpenAPI.

Image storage details (`S3ImageStorageAdapter`):
- Uploads are processed with `sharp`: auto-rotate, resized to `RMU_MEDIA_IMAGE_MAX_WIDTH` (no enlargement), re-encoded as PNG if input is PNG, otherwise JPEG q85.
- Storage key is `<category>/<imageId>.<png|jpg>`; the S3 object key is that prefixed with `RMU_MEDIA_S3_BASE_FOLDER`. Persisted `storageKey` excludes the base folder.
- `RMU_MEDIA_S3_BASE_FOLDER` is the root of rmu-mfe-assets, so the image `url` is the `storageKey` itself, a path relative to the assets root (`images/<category>/<file>`). Entities store that path and the frontends resolve it against `RMU_MFE_ASSETS_URI`; no public host is stored. `RMU_MEDIA_S3_ENDPOINT` + `FORCE_PATH_STYLE` support S3-compatible stores.
- The storage key is fixed when the file is uploaded: changing the category of an image only changes its metadata, and the object stays under the folder of the old category (a new file is stored under the current category).
- Import derives an image's category from the parent folder name of the object key: objects of a folder that is not a category (`IMAGE_CATEGORIES`) are not imported and go to the task `errors`. It skips objects already registered (by `storageKey`).

`main.ts` also connects a Kafka microservice transport, so a reachable broker is needed at startup.

## Imports and style

ESM: relative imports ending in `.js` (`import { X } from '../shared/x.js'`), `import type` for type-only imports (`verbatimModuleSyntax`). Files are kebab-case with role suffixes (`*.command.ts`, `*.handler.ts`, `*.dto.ts`, `*.port.ts`, `mongo.*.repository.ts`). SWC gotchas: give `@Prop`/`@ApiProperty` an explicit `type` for string-union aliases and nullable fields, and never use a bare `@Inject()`.

Problems found while migrating to the template (spec 020) are in the workspace `docs/reports/api-template-rollout-findings.md`; tests that expose an open one are `it.skip('… [F-media-NN]')`.

## Commits and releases

Commit messages must follow Conventional Commits (`feat:`, `fix:`, `chore:`, ...); a husky `commit-msg` hook runs commitlint (`commitlint.config.cjs`) and rejects anything else.

`make create-release` (non-interactive, run from a clean `develop`) merges `develop` into `master` with `--no-ff` and runs semantic-release (`release.config.cjs`). semantic-release works out the version from the commits since the last tag: a breaking change bumps major, `feat` bumps minor, anything else bumps patch. `RELEASE_BUMP=patch|minor|major` forces the bump. It updates `package.json`/`CHANGELOG.md`, commits `chore(release): X.Y.Z`, tags `X.Y.Z` (no `v` prefix) and pushes `master` plus the tag. It does not publish to npm or create a GitHub release. The target then merges `master` back into `develop`, sets the version to `X.Y.(Z+1)-SNAPSHOT` and pushes `develop`. If no release is produced, local `master` is reset to the remote and the target fails.
