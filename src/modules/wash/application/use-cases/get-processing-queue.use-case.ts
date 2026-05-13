import { Inject, Injectable } from '@nestjs/common';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

@Injectable()
export class GetProcessingQueueUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
  ) {}

  async execute(): Promise<{ items: Awaited<ReturnType<WashRepository['findProcessingQueue']>> }> {
    const items = await this.repo.findProcessingQueue();
    return { items };
  }
}
