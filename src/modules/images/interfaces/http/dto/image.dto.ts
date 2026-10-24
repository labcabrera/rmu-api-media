import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Image } from '../../../domain/aggregates/image.js';
import type { ImageCategory } from '../../../domain/entities/image-category.js';
import { PaginationDto } from '../../../../shared/interfaces/http/dto/page.dto.js';

export class ImageDto {
  @ApiProperty({ description: 'Unique image identifier' })
  id: string;

  @ApiProperty({ type: String, description: 'Image category', example: 'avatar' })
  category: ImageCategory;

  @ApiProperty({
    description: 'Image URL relative to the root of rmu-mfe-assets (resolved by the frontends against RMU_MFE_ASSETS_URI)',
    example: 'images/races/elf.png',
  })
  url: string;

  @ApiProperty({ description: 'Stored object key' })
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

  @ApiProperty({ description: 'Whether the image has been verified by synchronization' })
  verified: boolean;

  @ApiProperty({ description: 'Owner user id' })
  owner: string;

  @ApiProperty({ description: 'Version of optimistic concurrency: send it back in the PATCH to detect a concurrent change', example: 0 })
  version: number;

  static fromEntity(entity: Image): ImageDto {
    const dto = new ImageDto();
    dto.id = entity.id;
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
