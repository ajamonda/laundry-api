import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { GetActiveRoutesUseCase } from '../../application/use-cases/get-active-routes.use-case';
import { GetRouteByCodeUseCase } from '../../application/use-cases/get-route-by-code.use-case';

@ApiTags('processing-routes')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@Controller('processing-routes')
export class ProcessingRouteController {
  constructor(
    private readonly getActiveRoutes: GetActiveRoutesUseCase,
    private readonly getRouteByCode: GetRouteByCodeUseCase,
  ) {}

  @Get()
  findAll() {
    return this.getActiveRoutes.execute();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.getRouteByCode.execute(code);
  }
}
