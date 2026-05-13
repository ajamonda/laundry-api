import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StaffDevLoginRequestDto {
  @ApiProperty({ example: 'staff-1' })
  @IsString()
  @IsNotEmpty()
  staffId!: string;
}
