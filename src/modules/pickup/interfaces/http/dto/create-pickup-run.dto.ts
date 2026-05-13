import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePickupRunRequestDto {
  @ApiProperty({ example: 'PICKUP-VAN-01' })
  @IsString()
  @IsNotEmpty()
  vehicleCode!: string;
}
