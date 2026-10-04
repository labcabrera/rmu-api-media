# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project

NestJS 11 / TypeScript REST API for media (images) in RMU Online (Rolemaster Unified fan platform, see https://github.com/labcabrera/rmu-platform). Images are stored in S3 and their metadata in MongoDB. Default port 3011; Swagger UI at `/api-docs`, raw OpenAPI JSON at `/api-spec`.

## Commands

```bash
npm run start:dev        # watch mode (needs .env, see below)
npm run build            # nest build -> dist/
npm run lint             # eslint --fix over src/test
npm run format           # prettier (singleQuote, printWidth 140, arrowParens avoid)
npm test                 # jest (passes with no tests; there are currently no spec files)
npx jest path/to/file.spec.ts        # single test file
npx jest -t "test name"              # single test by name
npm run test:e2e         # uses ./test/e2e/jest-e2e.json (directory does not exist yet)
make docker-run          # build image and run on docker network `rmu-network` using .env.docker
make create-release      # semantic-release based release (see below)
```

Unit specs are matched at `src/**/*.spec.ts` and `test/**/*.spec.ts`; e2e specs are `*.e2e-spec.ts` under `test/e2e/`.

## Configuration

`ConfigModule` loads `.env` and validates it with a Joi schema in `src/app.module.ts` — the app fails at startup if required vars are missing. Two templates, both expecting the infrastructure started from `rmu-platform`:

- `.env.example` → `.env`: running on the host (`npm run start:dev`) with `COMPOSE_PROFILES=infrastructure`. Everything is `localhost`; Kafka is `localhost:9093` (the `PLAINTEXT_HOST` listener). `localhost:9092` looks like it works but the broker then advertises `rmu-kafka-broker:9092`, which the host cannot resolve.
- `.env.docker.example` → `.env.docker`: `make docker-run` on the `rmu-network` Docker network. Uses in-network hostnames (`rmu-mongo`, `rmu-keycloak:8080`, `rmu-kafka-broker:9092`).

In the full Compose stack (`infrastructure,apis`) neither file is used: `rmu-platform/compose.yaml` injects the environment.

Required: Mongo URI (`RMU_MONGO_MEDIA_URI`), Keycloak IAM (`RMU_IAM_*`), Kafka (`RMU_KAFKA_*`), S3 (`RMU_MEDIA_S3_REGION`, `RMU_MEDIA_S3_BUCKET`). Add any new env var to that schema.

## Architecture

Hexagonal / DDD layout with NestJS CQRS. Each feature module under `src/modules/<feature>/` is split into:

- `domain/` — aggregates (extend `BaseAggregateRoot<Props>`, private constructor, `create()` generates a UUID, `fromProps()` rehydrates, `getProps()` for persistence/events) and value types.
- `application/` — `cqrs/commands`, `cqrs/queries`, `cqrs/handlers`, and `ports/` (interfaces). Commands carry `userId` and `roles` from the JWT (`AuthenticatedCommand` in shared).
- `infrastructure/` — adapters implementing ports (Mongo repositories, S3 storage, Mongoose models).
- `interfaces/http/` — controllers and DTOs. DTOs own the mapping: static `toCommand(...)` on request DTOs and `fromEntity(...)` on response DTOs.

Ports are bound to adapters with **string injection tokens** in the module (e.g. `'ImageRepository'` → `MongoImageRepository`, `'ImageStoragePort'` → `S3ImageStorageAdapter`) and injected with `@Inject('<Token>')`. Controllers only talk to `CommandBus`/`QueryBus`.

Modules:
- `auth` — Passport JWT strategy validating RS256 tokens against Keycloak JWKS (`RMU_IAM_JWK_URI`). `req.user` is `{ id: sub, roles: groups, ... }`. Controllers use `@UseGuards(JwtAuthGuard)`.
- `shared` — cross-cutting base classes: `MongoBaseRepository` (generic `findById`/`findByRsql`/save/delete with pagination), RSQL parser for the `q` query param (`PagedQueryDto`), `QueryCriteria` + Mongo mapper, `BaseEntityGuard` (RBAC: public/owner/`RMU_ADMIN` checks — not yet wired into images), `DomainError` hierarchy mapped to HTTP status by the global `DomainExceptionFilter`, Kafka producer, health controller.
- `images` — upload, list (RSQL), update (metadata and/or file), delete, and bulk import of existing S3 objects.

Image storage details (`S3ImageStorageAdapter`):
- Uploads are processed with `sharp`: auto-rotate, resized to `RMU_MEDIA_IMAGE_MAX_WIDTH` (no enlargement), re-encoded as PNG if input is PNG, otherwise JPEG q85.
- Storage key is `<category>/<imageId>.<png|jpg>`; the S3 object key is that prefixed with `RMU_MEDIA_S3_BASE_FOLDER`. Persisted `storageKey` excludes the base folder.
- Public URL is `RMU_MEDIA_S3_PUBLIC_BASE_URL/<storageKey>` (falls back to the bucket's S3 URL). `RMU_MEDIA_S3_ENDPOINT` + `FORCE_PATH_STYLE` support S3-compatible stores.
- Import derives an image's category from the parent folder name of the object key and skips objects already registered (by `storageKey`).

`main.ts` also connects a Kafka microservice transport, so a reachable broker is needed at startup.

## Imports and style

Use absolute `src/...` imports (mapped in tsconfig and jest `moduleNameMapper`) or relative paths within a module. Files are kebab-case with role suffixes (`*.command.ts`, `*.handler.ts`, `*.dto.ts`, `mongo.*.repository.ts`).

## Commits and releases

Commit messages must follow Conventional Commits (`feat:`, `fix:`, `chore:`, ...); a husky `commit-msg` hook runs commitlint (`commitlint.config.js`) and rejects anything else.

`make create-release` (non-interactive, run from a clean `develop`) merges `develop` into `master` with `--no-ff` and runs semantic-release (`release.config.js`). semantic-release works out the version from the commits since the last tag: a breaking change bumps major, `feat` bumps minor, anything else bumps patch. `RELEASE_BUMP=patch|minor|major` forces the bump. It updates `package.json`/`package-lock.json`/`CHANGELOG.md`, commits `chore(release): X.Y.Z`, tags `X.Y.Z` (no `v` prefix) and pushes `master` plus the tag. It does not publish to npm or create a GitHub release. The target then merges `master` back into `develop`, sets the version to `X.Y.(Z+1)-SNAPSHOT` and pushes `develop`. If no release is produced, local `master` is reset to the remote and the target fails.
