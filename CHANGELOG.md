# [0.2.0](https://github.com/labcabrera/rmu-api-media/compare/0.1.2...0.2.0) (2026-11-11)


* feat!: list base images from the assets manifest and store uploads under their own prefix ([17fdadd](https://github.com/labcabrera/rmu-api-media/commit/17fdadd9600db34c6f5e9da5137d2a4800a7b095))
* feat!: remove the import of images from s3 ([91ca4eb](https://github.com/labcabrera/rmu-api-media/commit/91ca4ebbff2bfddc40304d3ce88342d50d7fcf87))
* feat(images)!: return image URLs relative to the assets root ([39d76bf](https://github.com/labcabrera/rmu-api-media/commit/39d76bfdc0feea099c1990edf22ffa5b7e0e6a27))


### Bug Fixes

* check who uploads, changes, deletes and imports images ([3f83d61](https://github.com/labcabrera/rmu-api-media/commit/3f83d613633b0a9bcdd863f06d67d3ccbc46ab83))
* document the image search, page and status codes as they are ([67fa0c1](https://github.com/labcabrera/rmu-api-media/commit/67fa0c1ebee5a70915f0799c0acf23751a128471))
* give the Kafka consumer its own group ([7633108](https://github.com/labcabrera/rmu-api-media/commit/7633108334d5bcf3e1503d419e28b6af3a3d7f67))
* skip S3 objects outside a category folder when importing ([5c9a02f](https://github.com/labcabrera/rmu-api-media/commit/5c9a02fc12900748e52e1fe7ea856a6ef2116bcc))
* sync package-lock with conventional-commits-filter peer dependency ([da74deb](https://github.com/labcabrera/rmu-api-media/commit/da74deb9b9ef8c7280f630656a5d7f02a9a562b5))
* updated configuration examples and cleanup old docker scripts ([7011558](https://github.com/labcabrera/rmu-api-media/commit/70115580009c8c788225fd2bd33b7b35961c0985))
* validate request bodies without implicit conversion (spec 044) ([2298db1](https://github.com/labcabrera/rmu-api-media/commit/2298db157e44da59ab9260c35c061a8b1f53adb6))
* validate the image folder and silence the reserved errors key ([4178361](https://github.com/labcabrera/rmu-api-media/commit/417836151f3f5c6ac174889e2c4f6c4ecaac19f8))


### Features

* add a script that moves the old uploads to the uploads prefix ([8265e93](https://github.com/labcabrera/rmu-api-media/commit/8265e930fda31ac24635bda3ffedf4241a4eb9f3))
* adopt the api-core HTTP contract and repository (spec 020) ([f3b1a60](https://github.com/labcabrera/rmu-api-media/commit/f3b1a60a87275f4cc063dc211ec43befdcfd6173))
* **auth:** validate token issuer and audience ([79ce10a](https://github.com/labcabrera/rmu-api-media/commit/79ce10a864b10c95aa6c2f057df3b535adc66c3d))
* get /v1/info and admin /v1/stats ([fdf979f](https://github.com/labcabrera/rmu-api-media/commit/fdf979fce0af2453d2dcd2d900cd79bf11fe9c94))
* **images:** chronicle category, scope and delete by scope ([a9d15fe](https://github.com/labcabrera/rmu-api-media/commit/a9d15feb9651d4b51f52da815fe703fbcd9cb40a))
* **images:** cultures image category ([8c8d06b](https://github.com/labcabrera/rmu-api-media/commit/8c8d06bd60320ac62853042f67dae519b9c3dd21))
* **images:** spells image category ([a7091c0](https://github.com/labcabrera/rmu-api-media/commit/a7091c0181bca1d76ddbd5d7de04ec17d008a4c0))
* **images:** weapons and armor image categories ([82f3d28](https://github.com/labcabrera/rmu-api-media/commit/82f3d28b06e535a7fc4be8edaeb9f4d0b8e23186))


### BREAKING CHANGES

* RMU_MEDIA_BASE_MANIFEST_URI is required, RMU_MEDIA_S3_BASE_FOLDER and
RMU_MEDIA_S3_IMAGE_FOLDER are gone, and new uploads have the url uploads/<category>/<id>.<ext>
instead of images/<category>/<id>.<ext>. The listing includes the base images.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
* POST /v1/images/import and GET /v1/images/import/:taskId are gone, with the
image import tasks and RMU_MEDIA_IMAGE_IMPORT_PARALLELISM and RMU_MEDIA_IMAGE_IMPORT_BATCH_SIZE.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
* ImageDto.url is a relative path instead of an absolute URL.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

## [0.1.2](https://github.com/labcabrera/rmu-api-media/compare/0.1.1...0.1.2) (2026-10-04)
