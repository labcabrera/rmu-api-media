import { ApiProperty } from '@nestjs/swagger';

/** The answer of `DELETE /v1/images?scope=…`. */
export class DeletedImagesDto {
  @ApiProperty({ description: 'How many images were deleted', example: 3 })
  deleted: number;

  static of(deleted: number): DeletedImagesDto {
    const dto = new DeletedImagesDto();
    dto.deleted = deleted;
    return dto;
  }
}
