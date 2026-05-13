import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HandoffPickupBagRequestDto {
  @ApiProperty({ example: 'pickup-run-id' })
  @IsString()
  @IsNotEmpty()
  runId!: string;
}
