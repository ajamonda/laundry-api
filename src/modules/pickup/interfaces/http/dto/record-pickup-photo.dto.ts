import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class RecordPickupPhotoRequestDto {
  @ApiProperty({ example: 'pickup-run-id' })
  @IsString()
  @IsNotEmpty()
  runId!: string;

  @ApiProperty({ example: 'https://example.com/pickup-photo.jpg' })
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  photoUrl!: string;
}
