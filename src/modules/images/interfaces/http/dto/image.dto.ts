import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Image } from '../../../domain/aggregates/image.js';
import type { ImageView } from '../../../application/image-view.js';
import { BaseImage } from '../../../domain/entities/base-image.js';
import { IMAGE_SOURCES, type ImageSource } from '../../../domain/entities/image-source.js';
import { IMAGE_VISIBILITIES, type ImageVisibility } from '../../../domain/entities/image-visibility.js';
import { PaginationDto } from '../../../../shared/interfaces/http/dto/page.dto.js';

export class ImageDto {
  @ApiProperty({
    description: 'Unique image identifier: a uuid for a user image, `base:<path>` for a base image (URL-encode it in a path)',
    example: 'base:images/races/generic-elf-01.png',
  })
  id: string;

  @ApiProperty({ type: String, enum: IMAGE_SOURCES, description: 'base: an image of rmu-mfe-assets (read-only); user: an upload' })
  source: ImageSource;

  @ApiProperty({ type: String, enum: IMAGE_VISIBILITIES, description: 'Who sees the image; every image is public for now' })
  visibility: ImageVisibility;

  @ApiProperty({ type: String, description: 'Image category (the folder of a base image)', example: 'avatars' })
  category: string;

  @ApiProperty({
    description:
      'Relative URL: `images/...` for a base image (resolved against RMU_MFE_ASSETS_URI), `uploads/...` for a user image (against RMU_MFE_MEDIA_URI)',
    example: 'uploads/avatars/0b7c1f9e-0000-4000-8000-000000000000.png',
  })
  url: string;

  @ApiProperty({ description: 'Stored object key (the path of a base image)' })
  storageKey: string;

  @ApiProperty({ description: 'Image content type', example: 'image/jpeg' })
  contentType: string;

  @ApiProperty({ description: 'Image size in bytes' })
  sizeBytes: number;

  @ApiPropertyOptional({ description: 'Image width in pixels' })
  width?: number;

  @ApiPropertyOptional({ description: 'Image height in pixels' })
  height?: number;

  @ApiPropertyOptional({ description: 'Original uploaded filename' })
  originalFilename?: string;

  @ApiPropertyOptional({ description: 'Alternative text' })
  altText?: string;

  @ApiPropertyOptional({ description: 'Extra metadata' })
  metadata?: Record<string, string>;

  @ApiProperty({ description: 'Whether the image has been verified: always true for a base image' })
  verified: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Owner user id; null for a base image' })
  owner: string | null;

  @ApiProperty({ description: 'Version of optimistic concurrency: send it back in the PATCH to detect a concurrent change', example: 0 })
  version: number;

  static fromView(view: ImageView): ImageDto {
    return view instanceof BaseImage ? ImageDto.fromBase(view) : ImageDto.fromEntity(view);
  }

  static fromBase(image: BaseImage): ImageDto {
    const dto = new ImageDto();
    dto.id = image.id;
    dto.source = image.source;
    dto.visibility = image.visibility;
    dto.version = image.version;
    dto.category = image.category;
    dto.url = image.url;
    dto.storageKey = image.path;
    dto.contentType = image.contentType;
    dto.sizeBytes = image.sizeBytes;
    dto.width = image.width ?? undefined;
    dto.height = image.height ?? undefined;
    dto.verified = image.verified;
    dto.owner = image.owner;
    return dto;
  }

  static fromEntity(entity: Image): ImageDto {
    const dto = new ImageDto();
    dto.id = entity.id;
    dto.source = entity.source;
    dto.visibility = entity.visibility;
    dto.version = entity.version;
    dto.category = entity.category;
    dto.url = entity.url;
    dto.storageKey = entity.storageKey;
    dto.contentType = entity.contentType;
    dto.sizeBytes = entity.sizeBytes;
    dto.width = entity.width;
    dto.height = entity.height;
    dto.originalFilename = entity.originalFilename;
    dto.altText = entity.altText;
    dto.metadata = entity.metadata;
    dto.verified = entity.verified;
    dto.owner = entity.owner;
    return dto;
  }
}

export class ImagePageDto {
  @ApiProperty({ type: [ImageDto], description: 'Images' })
  content: ImageDto[];

  @ApiProperty({ type: PaginationDto, description: 'Pagination information' })
  pagination: PaginationDto;
}
