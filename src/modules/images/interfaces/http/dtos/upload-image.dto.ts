import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UploadImageCommand } from 'src/modules/images/application/cqrs/commands/upload-image.command';
import { IMAGE_CATEGORIES } from 'src/modules/images/domain/entities/image-category';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import type { UploadedImageFile } from './uploaded-image-file';

export class UploadImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file' })
  file: unknown;

  @ApiProperty({ description: 'Image category', enum: IMAGE_CATEGORIES, example: 'generic' })
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
