import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../../../common/auth/current-staff.decorator';
import { StaffPrincipal } from '../../../../common/auth/current-principal';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { CreatePickupRunUseCase } from '../../application/use-cases/create-pickup-run.use-case';
import { GetPickupRequestDetailUseCase } from '../../application/use-cases/get-pickup-request-detail.use-case';
import { GetPickupRequestsUseCase } from '../../application/use-cases/get-pickup-requests.use-case';
import { HandoffPickupBagUseCase } from '../../application/use-cases/handoff-pickup-bag.use-case';
import { PutItemsIntoPickupBagUseCase } from '../../application/use-cases/put-items-into-pickup-bag.use-case';
import { RecordPickupPhotoUseCase } from '../../application/use-cases/record-pickup-photo.use-case';
import { RegisterPickupBagUseCase } from '../../application/use-cases/register-pickup-bag.use-case';
import { CreatePickupRunRequestDto } from './dto/create-pickup-run.dto';
import { HandoffPickupBagRequestDto } from './dto/handoff-pickup-bag.dto';
import { PickupRequestsQueryDto } from './dto/pickup-requests-query.dto';
import { PutItemsIntoPickupBagRequestDto } from './dto/put-items-into-pickup-bag.dto';
import { RecordPickupPhotoRequestDto } from './dto/record-pickup-photo.dto';
import { RegisterPickupBagRequestDto } from './dto/register-pickup-bag.dto';

@ApiTags('pickup')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@StaffRoles('PICKUP')
@Controller('pickup')
export class PickupController {
  constructor(
    private readonly getPickupRequestsUseCase: GetPickupRequestsUseCase,
    private readonly getPickupRequestDetailUseCase: GetPickupRequestDetailUseCase,
    private readonly createPickupRunUseCase: CreatePickupRunUseCase,
    private readonly registerPickupBagUseCase: RegisterPickupBagUseCase,
    private readonly recordPickupPhotoUseCase: RecordPickupPhotoUseCase,
    private readonly putItemsIntoPickupBagUseCase: PutItemsIntoPickupBagUseCase,
    private readonly handoffPickupBagUseCase: HandoffPickupBagUseCase,
  ) {}

  @Get('requests')
  getRequests(@Query() query: PickupRequestsQueryDto) {
    return this.getPickupRequestsUseCase.execute(query);
  }

  @Get('requests/:orderId')
  getRequestDetail(@Param('orderId') orderId: string) {
    return this.getPickupRequestDetailUseCase.execute(orderId);
  }

  @Post('runs')
  createRun(
    @CurrentStaff() staff: StaffPrincipal,
    @Body() body: CreatePickupRunRequestDto,
  ) {
    return this.createPickupRunUseCase.execute({
      staffId: staff.staffId,
      vehicleCode: body.vehicleCode,
    });
  }

  @Post('runs/:runId/bags')
  registerBag(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('runId') runId: string,
    @Body() body: RegisterPickupBagRequestDto,
  ) {
    return this.registerPickupBagUseCase.execute({
      staffId: staff.staffId,
      runId,
      bagBarcode: body.bagBarcode,
    });
  }

  @Post('requests/:orderId/photos')
  recordPickupPhoto(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('orderId') orderId: string,
    @Body() body: RecordPickupPhotoRequestDto,
  ) {
    return this.recordPickupPhotoUseCase.execute({
      staffId: staff.staffId,
      orderId,
      runId: body.runId,
      photoUrl: body.photoUrl,
    });
  }

  @Post('bags/:bagBarcode/items')
  putItemsIntoBag(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('bagBarcode') bagBarcode: string,
    @Body() body: PutItemsIntoPickupBagRequestDto,
  ) {
    return this.putItemsIntoPickupBagUseCase.execute({
      staffId: staff.staffId,
      bagBarcode,
      runId: body.runId,
      orderId: body.orderId,
      itemIds: body.itemIds,
    });
  }

  @Post('bags/:bagBarcode/handoff')
  handoffBag(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('bagBarcode') bagBarcode: string,
    @Body() body: HandoffPickupBagRequestDto,
  ) {
    return this.handoffPickupBagUseCase.execute({
      staffId: staff.staffId,
      bagBarcode,
      runId: body.runId,
    });
  }
}
