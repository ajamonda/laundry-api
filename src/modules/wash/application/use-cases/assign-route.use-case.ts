import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { RouteEngineService } from '../../../processing-route/domain/route-engine.service';
import { ItemNotAssignableError, TagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';
import { AssignRouteResult } from '../../domain/wash.types';

/**
 * Atomically: create the processing plan + flip status TAGGED→SORTED.
 * One transaction so a plan can never exist for an item still in TAGGED.
 */
@Injectable()
export class AssignRouteUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
    private readonly routeEngine: RouteEngineService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    tagBarcode: string;
    routeCode: string;
    actor: ActorContext;
  }): Promise<AssignRouteResult> {
    const item = await this.repo.findItemByTagBarcode(input.tagBarcode);
    if (!item) throw new TagNotFoundError(input.tagBarcode);
    if (item.status !== 'TAGGED') throw new ItemNotAssignableError(item.itemId);

    return this.prisma.$transaction(async (tx) => {
      const processingState = await this.routeEngine.createPlan(
        {
          orderItemId: item.itemId,
          routeCode: input.routeCode,
          actor: input.actor,
        },
        tx,
      );

      const updatedItem = await this.repo.setItemStatus(
        {
          itemId: item.itemId,
          status: 'SORTED',
        },
        tx,
      );

      return { item: updatedItem, processingState };
    });
  }
}
