#!/usr/bin/env node
// Spec 057, decision 10: moves the uploads stored before spec 057 out of the prefix of rmu-mfe-assets.
//
// Before spec 057 an upload was stored at `<RMU_MEDIA_S3_BASE_FOLDER>/images/<category>/<id>.<ext>` (base folder
// `rmu-mfe-assets`), with `storageKey` and `url` `images/<category>/<id>.<ext>`, so a deployment of the assets could
// delete it. Now uploads live at `<RMU_MEDIA_S3_UPLOADS_PREFIX>/<category>/<file>` (`uploads/...`).
//
// For every image of `rmu-media.images` whose `storageKey` is not under the uploads prefix, the script copies the S3
// object `<OLD_BASE_FOLDER>/<storageKey>` to `<uploads prefix>/<category>/<file name>`, then sets `storageKey` and `url`
// to the new key, adds 1 to `version` and records the old url in `movedFrom`. It also sets `visibility: 'public'` on
// the images that have none. With DELETE_OLD=1 it deletes the old object of every moved image (also of those moved by
// an earlier run, through `movedFrom`).
//
// It is idempotent: an image already under the uploads prefix is not copied again, and the update only applies while
// the image still has the old key. An image whose old object is missing is reported and left as it is (unless the new
// object already exists, which is the result of an interrupted run: then only the document is updated).
//
// At the end it prints to stdout a JSON object that maps each old url to its new one, for every image moved by this or
// an earlier run; `--map-out <file>` also writes it to a file. A platform migration uses it to rewrite the image paths
// stored by the other APIs. The progress goes to stderr.
//
// Usage, with the environment of the API (the script never reads .env):
//
//   RMU_MONGO_MEDIA_URI='mongodb://<user>:<password>@<host>:27017/rmu-media?authSource=admin' \
//   RMU_MEDIA_S3_BUCKET=<bucket> RMU_MEDIA_S3_REGION=<region> \
//   [RMU_MEDIA_S3_ENDPOINT=http://<s3-compatible-host>:<port> RMU_MEDIA_S3_FORCE_PATH_STYLE=true] \
//   [RMU_MEDIA_S3_ACCESS_KEY_ID=... RMU_MEDIA_S3_SECRET_ACCESS_KEY=...] \
//   [RMU_MEDIA_S3_UPLOADS_PREFIX=uploads] [OLD_BASE_FOLDER=rmu-mfe-assets] [DRY_RUN=1] [DELETE_OLD=1] \
//     node scripts/move-uploads.mjs [--map-out <file>]
//
// DRY_RUN=1 only reports what it would do (and the map it would produce); it writes nothing to S3 or Mongo.
import { writeFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';

const COLLECTION = 'images';
const flag = name => ['1', 'true'].includes((process.env[name] ?? '').toLowerCase());
const trimSlashes = value => value.replace(/^\/+/, '').replace(/\/+$/, '');
const log = (...args) => console.error(...args);

const mongoUri = process.env.RMU_MONGO_MEDIA_URI;
const bucket = process.env.RMU_MEDIA_S3_BUCKET;
const region = process.env.RMU_MEDIA_S3_REGION;
if (!mongoUri || !bucket || !region) {
  log('RMU_MONGO_MEDIA_URI, RMU_MEDIA_S3_BUCKET and RMU_MEDIA_S3_REGION are required: export the environment of the API first.');
  process.exit(2);
}
const uploadsPrefix = trimSlashes(process.env.RMU_MEDIA_S3_UPLOADS_PREFIX ?? 'uploads');
const oldBaseFolder = trimSlashes(process.env.OLD_BASE_FOLDER ?? 'rmu-mfe-assets');
const dryRun = flag('DRY_RUN');
const deleteOld = flag('DELETE_OLD');
const mapOutIndex = process.argv.indexOf('--map-out');
const mapOut = mapOutIndex >= 0 ? process.argv[mapOutIndex + 1] : undefined;
if (mapOutIndex >= 0 && !mapOut) {
  log('--map-out needs a file name.');
  process.exit(2);
}
if (!uploadsPrefix) {
  log('RMU_MEDIA_S3_UPLOADS_PREFIX cannot be empty.');
  process.exit(2);
}

const accessKeyId = process.env.RMU_MEDIA_S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.RMU_MEDIA_S3_SECRET_ACCESS_KEY;
const s3 = new S3Client({
  region,
  endpoint: process.env.RMU_MEDIA_S3_ENDPOINT || undefined,
  forcePathStyle: flag('RMU_MEDIA_S3_FORCE_PATH_STYLE'),
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

const oldKeyOf = storageKey => (oldBaseFolder ? `${oldBaseFolder}/${trimSlashes(storageKey)}` : trimSlashes(storageKey));
const newKeyOf = image => `${uploadsPrefix}/${image.category}/${posix.basename(image.storageKey)}`;
const copySource = key => `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function exists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

const summary = { moved: 0, alreadyCopied: 0, missing: 0, failed: 0, deleted: 0, visibility: 0 };

await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
try {
  const images = mongoose.connection.db.collection(COLLECTION);
  log(
    `Database ${mongoose.connection.db.databaseName}, bucket ${bucket}, old prefix ${oldBaseFolder || '(root)'}/, ` +
      `uploads prefix ${uploadsPrefix}/${dryRun ? ' (dry run)' : ''}${deleteOld ? ' (deleting old objects)' : ''}`,
  );

  const pending = await images
    .find({ storageKey: { $not: { $regex: `^${uploadsPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/` } } })
    .project({ _id: 1, category: 1, storageKey: 1, url: 1 })
    .toArray();
  log(`Images outside ${uploadsPrefix}/: ${pending.length}`);

  for (const image of pending) {
    const oldKey = oldKeyOf(image.storageKey);
    const newKey = newKeyOf(image);
    try {
      const oldExists = await exists(oldKey);
      const newExists = oldExists ? false : await exists(newKey);
      if (!oldExists && !newExists) {
        summary.missing++;
        log(`  MISSING ${image._id}: no object at ${oldKey}; left as it is`);
        continue;
      }
      log(`  ${image._id}: ${oldKey} -> ${newKey}${oldExists ? '' : ' (already copied)'}`);
      if (!oldExists) summary.alreadyCopied++;
      if (dryRun) {
        summary.moved++;
        continue;
      }
      if (oldExists) await s3.send(new CopyObjectCommand({ Bucket: bucket, Key: newKey, CopySource: copySource(oldKey) }));
      const result = await images.updateOne(
        { _id: image._id, storageKey: image.storageKey },
        { $set: { storageKey: newKey, url: newKey, movedFrom: image.url ?? image.storageKey }, $inc: { version: 1 } },
      );
      if (result.modifiedCount === 1) summary.moved++;
      else log(`  ${image._id} changed while it was moved; run the script again`);
    } catch (error) {
      summary.failed++;
      log(`  FAILED ${image._id}: ${error?.message ?? error}`);
    }
  }

  const withoutVisibility = await images.countDocuments({ visibility: { $exists: false } });
  log(`Images without visibility: ${withoutVisibility}${withoutVisibility && !dryRun ? ' (set to public)' : ''}`);
  if (!dryRun && withoutVisibility > 0) {
    summary.visibility = (await images.updateMany({ visibility: { $exists: false } }, { $set: { visibility: 'public' } })).modifiedCount;
  }

  // The map covers every image moved by this or an earlier run. In a dry run, it is the map the run would produce.
  const map = {};
  for (const image of await images
    .find({ movedFrom: { $exists: true } })
    .project({ movedFrom: 1, url: 1 })
    .toArray()) {
    map[image.movedFrom] = image.url;
  }
  if (dryRun) for (const image of pending) map[image.url ?? image.storageKey] = newKeyOf(image);

  if (deleteOld) {
    const moved = await images
      .find({ movedFrom: { $exists: true } })
      .project({ movedFrom: 1 })
      .toArray();
    for (const image of moved) {
      const oldKey = oldKeyOf(image.movedFrom);
      if (!(await exists(oldKey))) continue;
      log(`  delete ${oldKey}${dryRun ? ' (dry run)' : ''}`);
      if (!dryRun) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
      summary.deleted++;
    }
  }

  log(`Summary: ${JSON.stringify(summary)}`);
  const json = JSON.stringify(map, null, 2);
  if (mapOut) {
    await writeFile(mapOut, `${json}\n`);
    log(`Map of ${Object.keys(map).length} urls written to ${mapOut}`);
  }
  console.log(json);
  if (summary.failed > 0) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
