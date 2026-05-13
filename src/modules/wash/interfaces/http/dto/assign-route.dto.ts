import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AssignRouteDto {
  @ApiProperty({ example: 'GENERAL_CLOTHES_CLEANING' })
  @IsString()
  @MinLength(1)
  routeCode!: string;
}
