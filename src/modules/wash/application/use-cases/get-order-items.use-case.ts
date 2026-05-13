import { Inject, Injectable } from '@nestjs/common';
import { WashOrderNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

@Injectable()
export class GetOrderItemsUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
  ) {}

  async execute(orderId: string) {
    const order = await this.repo.findOrderWithItems(orderId);
    if (!order) throw new WashOrderNotFoundError(orderId);
    return order;
  }
}
