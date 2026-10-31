import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UploadImageCommand } from '../../../application/cqrs/commands/upload-image.command.js';
import { IMAGE_CATEGORIES } from '../../../domain/entities/image-category.js';
import type { ImageCategory } from '../../../domain/entities/image-category.js';
import type { UploadedImageFile } from './uploaded-image-file.js';
import { IMAGE_VISIBILITIES, SUPPORTED_IMAGE_VISIBILITIES, type ImageVisibility } from '../../../domain/entities/image-visibility.js';

export class UploadImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file' })
  file: unknown;

  @ApiProperty({ type: String, description: 'Image category', enum: IMAGE_CATEGORIES, example: 'generic' })
  @IsString()
  @IsIn(IMAGE_CATEGORIES)
  category: ImageCategory;

  @ApiPropertyOptional({ description: 'Alternative text', example: 'Human warrior portrait' })
  @IsString()
  @IsOptional()
  altText?: string;

  @ApiPropertyOptional({ description: 'JSON object with extra metadata', example: '{"source":"manual"}' })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiPropertyOptional({
    type: String,
    enum: IMAGE_VISIBILITIES,
    default: 'public',
    description: 'Who sees the image. Only `public` is accepted for now: `friends` and `private` are reserved (spec 057)',
  })
  @IsIn(SUPPORTED_IMAGE_VISIBILITIES, { message: 'visibility must be public: friends and private are not supported yet' })
  @IsOptional()
  visibility?: ImageVisibility;

  static toCommand(dto: UploadImageDto, file: UploadedImageFile, userId: string, userRoles: string[]) {
    return new UploadImageCommand(
      dto.category,
      file.buffer,
      file.mimetype,
      file.originalname,
      dto.altText,
      parseMetadata(dto.metadata),
      userId,
      userRoles,
      dto.visibility,
    );
  }
}

export function parseMetadata(metadata: string | undefined): Record<string, string> | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
  } catch {
    throw new BadRequestException('metadata must be a valid JSON object');
  }
}
