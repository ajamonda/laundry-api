import { Inject, Injectable } from '@nestjs/common';
import { TagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

@Injectable()
export class FindItemByTagUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
  ) {}

  async execute(tagBarcode: string) {
    const item = await this.repo.findItemByTagBarcode(tagBarcode);
    if (!item) throw new TagNotFoundError(tagBarcode);
    return item;
  }
}
