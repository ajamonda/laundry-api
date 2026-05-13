import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CustomerDevLoginRequestDto {
  @ApiProperty({ example: 'customer-1' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;
}
