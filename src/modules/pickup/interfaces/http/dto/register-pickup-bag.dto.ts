import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterPickupBagRequestDto {
  @ApiProperty({ example: 'PICKUP-BAG-001' })
  @IsString()
  @IsNotEmpty()
  bagBarcode!: string;
}
