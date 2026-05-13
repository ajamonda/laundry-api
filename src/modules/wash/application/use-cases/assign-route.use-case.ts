import { Inject, Injectable } from '@nestjs/common';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ItemNotAssignableError, TagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';
import { AssignRouteResult } from '../../domain/wash.types';

@Injectable()
export class AssignRouteUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly routeEngine: RouteEngineService,
  ) {}

  async execute(input: {
    tagBarcode: string;
    routeCode: string;
    actor: ActorContext;
  }): Promise<AssignRouteResult> {
    const item = await this.repo.findItemByTagBarcode(input.tagBarcode);
    if (!item) throw new TagNotFoundError(input.tagBarcode);
    if (item.status !== 'TAGGED') throw new ItemNotAssignableError(item.itemId);

    const processingState = await this.routeEngine.createPlan({
      orderItemId: item.itemId,
      routeCode: input.routeCode,
      actor: input.actor,
    });

    const updatedItem = await this.repo.setItemStatus({
      itemId: item.itemId,
      status: 'SORTED',
    });

    return { item: updatedItem, processingState };
  }
}
