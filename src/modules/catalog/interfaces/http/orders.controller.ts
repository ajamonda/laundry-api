import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case';
import { CreateOrderRequestDto } from './dto/create-order.dto';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly createOrderUseCase: CreateOrderUseCase) {}

  @Post()
  create(@Body() body: CreateOrderRequestDto) {
    return this.createOrderUseCase.execute({
      customerId: body.customerId,
      pickupSchedule: body.pickupSchedule
        ? new Date(body.pickupSchedule)
        : undefined,
      fulfillmentType: body.fulfillmentType,
      fulfillmentOptionCode: body.fulfillmentOptionCode,
      address: body.address,
      phoneNumber: body.phoneNumber,
      pickupDeliveryPlaceCode: body.pickupDeliveryPlaceCode,
      pickupDeliveryPlaceText: body.pickupDeliveryPlaceText,
      secondHandPickupRequested: body.secondHandPickupRequested,
      items: body.items,
    });
  }
}
