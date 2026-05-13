import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentStaff } from '../../../../common/auth/current-staff.decorator';
import { StaffPrincipal } from '../../../../common/auth/current-principal';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { CloseDeliveryRunUseCase } from '../../application/use-cases/close-delivery-run.use-case';
import { CreateDeliveryRunUseCase } from '../../application/use-cases/create-delivery-run.use-case';
import { GetActiveRunUseCase } from '../../application/use-cases/get-active-run.use-case';
import { GetDeliveryPackageUseCase } from '../../application/use-cases/get-delivery-package.use-case';
import { GetDeliveryVehiclesUseCase } from '../../application/use-cases/get-delivery-vehicles.use-case';
import { GetDeliveryWorkUseCase } from '../../application/use-cases/get-delivery-work.use-case';
import { GetLoadedPackagesUseCase } from '../../application/use-cases/get-loaded-packages.use-case';
import { HandoffItemUseCase } from '../../application/use-cases/handoff-item.use-case';
import { RecordHandoffPhotoUseCase } from '../../application/use-cases/record-handoff-photo.use-case';
import { ScanOutboundUseCase } from '../../application/use-cases/scan-outbound.use-case';
import { CreateDeliveryRunDto } from './dto/create-delivery-run.dto';
import { RecordHandoffPhotoDto } from './dto/record-handoff-photo.dto';

@ApiTags('delivery')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@StaffRoles('DELIVERY')
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly getDeliveryVehicles: GetDeliveryVehiclesUseCase,
    private readonly getActiveRun: GetActiveRunUseCase,
    private readonly getDeliveryPackage: GetDeliveryPackageUseCase,
    private readonly getDeliveryWork: GetDeliveryWorkUseCase,
    private readonly getLoadedPackages: GetLoadedPackagesUseCase,
    private readonly createDeliveryRun: CreateDeliveryRunUseCase,
    private readonly scanOutbound: ScanOutboundUseCase,
    private readonly handoffItem: HandoffItemUseCase,
    private readonly recordHandoffPhoto: RecordHandoffPhotoUseCase,
    private readonly closeDeliveryRun: CloseDeliveryRunUseCase,
  ) {}

  @ApiOperation({ summary: '배달 차량 목록', description: '활성 상태인 배달 차량 마스터 데이터를 반환합니다.' })
  @Get('vehicles')
  listVehicles() {
    return this.getDeliveryVehicles.execute();
  }

  @ApiOperation({ summary: '내 트럭에 실린 패키지', description: '현재 staff의 활성 run에 출고 스캔된, 아직 인도되지 않은(DELIVERING) 패키지 목록을 반환합니다. 활성 run이 없으면 빈 배열.' })
  @Get('runs/me/loaded-packages')
  myLoadedPackages(@CurrentStaff() staff: StaffPrincipal) {
    return this.getLoadedPackages.execute(staff.staffId);
  }

  @ApiOperation({ summary: '현재 활성 배달 런', description: '현재 로그인한 스태프의 ACTIVE 배달 런을 반환합니다. 없으면 null.' })
  @Get('runs/me/active')
  myActiveRun(@CurrentStaff() staff: StaffPrincipal) {
    return this.getActiveRun.execute(staff.staffId);
  }

  @ApiOperation({ summary: '배달 패키지 상세', description: 'packageId로 패키지 상세 정보를 조회합니다.' })
  @ApiResponse({ status: 404, description: '패키지를 찾을 수 없음' })
  @Get('packages/:packageId')
  getPackage(@Param('packageId') packageId: string) {
    return this.getDeliveryPackage.execute(packageId);
  }

  @ApiOperation({ summary: '배달 대상 패키지 목록', description: 'READY_FOR_DELIVERY 아이템이 있는 패키지 목록을 반환합니다.' })
  @ApiResponse({
    status: 200,
    description: '배달 대상 패키지 목록',
    schema: {
      example: [
        {
          packageId: 'package-uuid',
          orderId: 'order-uuid',
          address: '서울 강남구 테헤란로 1',
          phoneNumber: '010-1234-5678',
          fulfillmentType: 'DELIVERY',
          fulfillmentOptionCode: 'regular_delivery',
          pickupDeliveryPlaceCode: 'front_door',
          pickupDeliveryPlaceText: null,
          items: [
            { itemId: 'item-uuid-1', tagBarcode: 'TAG-0001', catalogItemCode: 'shirt', displayNameSnapshot: '셔츠', status: 'READY_FOR_DELIVERY' },
            { itemId: 'item-uuid-2', tagBarcode: 'TAG-0002', catalogItemCode: 'pants', displayNameSnapshot: '바지', status: 'READY_FOR_DELIVERY' },
          ],
        },
      ],
    },
  })
  @Get('work')
  getWork() {
    return this.getDeliveryWork.execute();
  }

  @ApiOperation({ summary: '배달 런 등록', description: '차량을 선택해 배달 런을 시작합니다. 스태프당 활성 런은 1개입니다.' })
  @ApiResponse({
    status: 201,
    description: '배달 런 생성 성공',
    schema: {
      example: {
        id: 'run-uuid',
        staffId: 'staff-1',
        vehicleCode: 'DELIVERY_VAN_01',
        vehicleDisplayName: '배달 밴 1호',
        status: 'ACTIVE',
        createdAt: '2026-05-11T09:00:00.000Z',
        closedAt: null,
      },
    },
  })
  @ApiResponse({ status: 409, description: '이미 활성 런이 존재하거나 차량이 사용 중' })
  @Post('runs')
  createRun(@CurrentStaff() staff: StaffPrincipal, @Body() body: CreateDeliveryRunDto) {
    return this.createDeliveryRun.execute({ staffId: staff.staffId, vehicleCode: body.vehicleCode });
  }

  @ApiOperation({ summary: '패키지 출고 스캔', description: '패키지 내 모든 아이템을 DELIVERING 상태로 전환합니다. 결제 완료 여부를 검증합니다.' })
  @ApiResponse({
    status: 201,
    description: '출고 스캔 성공',
    schema: {
      example: {
        packageId: 'package-uuid',
        orderId: 'order-uuid',
        items: [
          { itemId: 'item-uuid-1', status: 'DELIVERING', location: 'DELIVERING_TRUCK' },
          { itemId: 'item-uuid-2', status: 'DELIVERING', location: 'DELIVERING_TRUCK' },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: '패키지를 찾을 수 없거나 활성 배달 런 없음' })
  @ApiResponse({ status: 409, description: '결제 미완료(BillingNotPaidError) 또는 아이템 상태 불일치' })
  @Post('packages/:packageId/scan-outbound')
  scanPackageOutbound(@CurrentStaff() staff: StaffPrincipal, @Param('packageId') packageId: string) {
    return this.scanOutbound.execute({
      packageId,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @ApiOperation({ summary: '패키지 인도 완료', description: '패키지 내 모든 아이템을 FINISHED 상태로 전환합니다. 주문 완료 여부를 자동 계산합니다.' })
  @ApiResponse({
    status: 201,
    description: '인도 완료 성공',
    schema: {
      example: {
        packageId: 'package-uuid',
        orderId: 'order-uuid',
        items: [
          { itemId: 'item-uuid-1', status: 'FINISHED', location: 'CUSTOMER_DEST' },
          { itemId: 'item-uuid-2', status: 'FINISHED', location: 'CUSTOMER_DEST' },
        ],
        orderStatus: 'FINISHED',
      },
    },
  })
  @ApiResponse({ status: 404, description: '패키지를 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '패키지 내 아이템이 모두 DELIVERING 상태가 아님' })
  @Post('packages/:packageId/handoff')
  handoff(@CurrentStaff() staff: StaffPrincipal, @Param('packageId') packageId: string) {
    return this.handoffItem.execute({
      packageId,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @ApiOperation({ summary: '인도 사진 등록 (패키지당 1장)', description: '패키지의 인도 현장 사진 URL을 등록합니다. 같은 패키지에 다시 호출하면 URL이 갱신됩니다.' })
  @ApiResponse({
    status: 201,
    description: '사진 등록/갱신 성공',
    schema: {
      example: {
        id: 'photo-uuid',
        packageId: 'package-uuid',
        url: 'https://storage.example.com/handoff/photo-001.jpg',
        createdAt: '2026-05-11T14:30:00.000Z',
        updatedAt: '2026-05-11T14:30:00.000Z',
      },
    },
  })
  @Post('packages/:packageId/handoff-photo')
  recordPhoto(@Param('packageId') packageId: string, @Body() body: RecordHandoffPhotoDto) {
    return this.recordHandoffPhoto.execute({ packageId, url: body.url });
  }

  @ApiOperation({ summary: '배달 런 종료', description: '모든 배달이 완료된 후 배달 런을 종료합니다.' })
  @ApiResponse({
    status: 201,
    description: '런 종료 성공',
    schema: {
      example: {
        id: 'run-uuid',
        staffId: 'staff-1',
        vehicleCode: 'DELIVERY_VAN_01',
        vehicleDisplayName: '배달 밴 1호',
        status: 'CLOSED',
        createdAt: '2026-05-11T09:00:00.000Z',
        closedAt: '2026-05-11T17:00:00.000Z',
      },
    },
  })
  @Post('runs/:runId/close')
  closeRun(@Param('runId') runId: string) {
    return this.closeDeliveryRun.execute({ runId });
  }
}
