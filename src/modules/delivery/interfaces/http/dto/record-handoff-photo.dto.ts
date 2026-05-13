import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RecordHandoffPhotoDto {
  @ApiProperty({
    example: 'https://storage.example.com/handoff/photo-001.jpg',
    description: '인도 현장 사진 URL 또는 메모 문자열',
  })
  @IsString()
  @IsNotEmpty()
  url!: string;
}
