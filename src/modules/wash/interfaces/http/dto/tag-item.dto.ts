import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TagItemDto {
  @ApiProperty({ example: 'TAG-001' })
  @IsString()
  @MinLength(1)
  tagBarcode!: string;
}
