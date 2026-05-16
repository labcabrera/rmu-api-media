import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { UpdateImageCommand } from 'src/modules/images/application/cqrs/commands/update-image.command';
import { IMAGE_CATEGORIES } from 'src/modules/images/domain/entities/image-category';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import { parseMetadata } from './upload-image.dto';
import type { UploadedImageFile } from './uploaded-image-file';

export class UpdateImageDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Image file' })
  file?: unknown;

  @ApiPropertyOptional({ description: 'Image category', enum: IMAGE_CATEGORIES, example: 'avatar' })
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
    );
  }
}
