import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CompleteCustomerProfileRequestDto {
  @ApiProperty({ example: '010-0000-0000' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ example: 'Seoul' })
  @IsString()
  @IsNotEmpty()
  address!: string;
}
