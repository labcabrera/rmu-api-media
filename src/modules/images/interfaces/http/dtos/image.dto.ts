import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Image } from 'src/modules/images/domain/aggregates/image';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import { PaginationDto } from 'src/modules/shared/interfaces/http/dto/page.dto';

export class ImageDto {
  @ApiProperty({ description: 'Unique image identifier' })
  id: string;

  @ApiProperty({ description: 'Image category', example: 'avatar' })
  category: ImageCategory;

  @ApiProperty({ description: 'Public image URL' })
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

  @ApiProperty({ description: 'Owner user id' })
  owner: string;

  static fromEntity(entity: Image): ImageDto {
    const dto = new ImageDto();
    dto.id = entity.id;
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
    dto.owner = entity.owner;
    return dto;
  }
}

export class ImagePageDto {
  @ApiProperty({ type: [ImageDto], description: 'Images', isArray: true })
  content: ImageDto[];

  @ApiProperty({ type: PaginationDto, description: 'Pagination information' })
  pagination: PaginationDto;
}
