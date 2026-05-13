import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../../../common/auth/current-staff.decorator';
import { StaffPrincipal } from '../../../../common/auth/current-principal';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { AssignRouteUseCase } from '../../application/use-cases/assign-route.use-case';
import { CreatePackageUseCase } from '../../application/use-cases/create-package.use-case';
import { FindItemByTagUseCase } from '../../application/use-cases/find-item-by-tag.use-case';
import { GetBagUseCase } from '../../application/use-cases/get-bag.use-case';
import { GetOrderItemsUseCase } from '../../application/use-cases/get-order-items.use-case';
import { GetProcessingQueueUseCase } from '../../application/use-cases/get-processing-queue.use-case';
import { ScanStepUseCase } from '../../application/use-cases/scan-step.use-case';
import { TagItemUseCase } from '../../application/use-cases/tag-item.use-case';
import { AssignRouteDto } from './dto/assign-route.dto';
import { TagItemDto } from './dto/tag-item.dto';

@ApiTags('wash')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@StaffRoles('WASH')
@Controller('wash')
export class WashController {
  constructor(
    private readonly getBag: GetBagUseCase,
    private readonly findItemByTag: FindItemByTagUseCase,
    private readonly tagItem: TagItemUseCase,
    private readonly assignRoute: AssignRouteUseCase,
    private readonly scanStep: ScanStepUseCase,
    private readonly createPackage: CreatePackageUseCase,
    private readonly processingQueue: GetProcessingQueueUseCase,
    private readonly getOrderItems: GetOrderItemsUseCase,
  ) {}

  @Get('processing-queue')
  getProcessingQueue() {
    return this.processingQueue.execute();
  }

  @Get('bags/:barcode')
  findBag(@Param('barcode') barcode: string) {
    return this.getBag.execute(barcode);
  }

  @Get('orders/:orderId/items')
  findOrderItems(@Param('orderId') orderId: string) {
    return this.getOrderItems.execute(orderId);
  }

  @Get('tags/:tagBarcode')
  findItemByTagBarcode(@Param('tagBarcode') tagBarcode: string) {
    return this.findItemByTag.execute(tagBarcode);
  }

  @Post('items/:id/tag')
  attachTag(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id') id: string,
    @Body() body: TagItemDto,
  ) {
    return this.tagItem.execute({
      itemId: id,
      tagBarcode: body.tagBarcode,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @Post('tags/:tagBarcode/assign-route')
  assignItemRoute(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('tagBarcode') tagBarcode: string,
    @Body() body: AssignRouteDto,
  ) {
    return this.assignRoute.execute({
      tagBarcode,
      routeCode: body.routeCode,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @Post('tags/:tagBarcode/scan-step')
  scanItemStep(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('tagBarcode') tagBarcode: string,
  ) {
    return this.scanStep.execute({
      tagBarcode,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @Post('packages')
  createPackages() {
    return this.createPackage.execute();
  }
}
