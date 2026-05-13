import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDeliveryRunDto {
  @ApiProperty({
    example: 'DELIVERY_VAN_01',
    enum: ['DELIVERY_VAN_01', 'DELIVERY_VAN_02', 'DELIVERY_VAN_03'],
    description: '배달 차량 코드',
  })
  @IsString()
  vehicleCode!: string;
}
