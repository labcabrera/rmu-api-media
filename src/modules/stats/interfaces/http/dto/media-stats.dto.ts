import { ApiProperty } from '@nestjs/swagger';
import { CollectionStatsDto } from './collection-stats.dto.js';

export class ImageStatsDto extends CollectionStatsDto {
  @ApiProperty({ description: 'Bytes of every stored image', example: 1048576 })
  sizeBytes: number;
}

export class MediaStatsDto {
  @ApiProperty({ type: ImageStatsDto })
  images: ImageStatsDto;
}
