import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { UpdateImageCommand } from '../../../application/cqrs/commands/update-image.command.js';
import { IMAGE_CATEGORIES } from '../../../domain/entities/image-category.js';
import type { ImageCategory } from '../../../domain/entities/image-category.js';
import { parseMetadata } from './upload-image.dto.js';
import type { UploadedImageFile } from './uploaded-image-file.js';
import { IMAGE_VISIBILITIES, SUPPORTED_IMAGE_VISIBILITIES, type ImageVisibility } from '../../../domain/entities/image-visibility.js';

export class UpdateImageDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Image file' })
  file?: unknown;

  @ApiPropertyOptional({ type: String, description: 'Image category', enum: IMAGE_CATEGORIES, example: 'avatar' })
  @IsString()
  @IsIn(IMAGE_CATEGORIES)
  @IsOptional()
  category?: ImageCategory;

  @ApiPropertyOptional({ description: 'Alternative text', example: 'Updated portrait' })
  @IsString()
  @IsOptional()
  altText?: string;

  @ApiPropertyOptional({ description: 'JSON object with extra metadata', example: '{"source":"manual"}' })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiPropertyOptional({ description: 'Version the client read (from the GET); a different stored version is a 409', example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  version?: number;

  @ApiPropertyOptional({
    type: String,
    enum: IMAGE_VISIBILITIES,
    default: 'public',
    description: 'Who sees the image. Only `public` is accepted for now: `friends` and `private` are reserved (spec 057)',
  })
  @IsIn(SUPPORTED_IMAGE_VISIBILITIES, { message: 'visibility must be public: friends and private are not supported yet' })
  @IsOptional()
  visibility?: ImageVisibility;

  static toCommand(id: string, dto: UpdateImageDto, file: UploadedImageFile | undefined, userId: string, userRoles: string[]) {
    return new UpdateImageCommand(
      id,
      dto.category,
      file?.buffer,
      file?.mimetype,
      file?.originalname,
      dto.altText,
      parseMetadata(dto.metadata),
      userId,
      userRoles,
      dto.version,
      dto.visibility,
    );
  }
}
