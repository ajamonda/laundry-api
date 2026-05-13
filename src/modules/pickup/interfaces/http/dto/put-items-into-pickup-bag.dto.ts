import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class PutItemsIntoPickupBagRequestDto {
  @ApiProperty({ example: 'pickup-run-id' })
  @IsString()
  @IsNotEmpty()
  runId!: string;

  @ApiProperty({ example: 'order-id' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ example: ['order-item-id-1', 'order-item-id-2'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  itemIds!: string[];
}
