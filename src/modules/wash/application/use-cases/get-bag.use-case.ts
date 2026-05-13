import { Inject, Injectable } from '@nestjs/common';
import { WashBagNotFoundError } from '../../domain/wash.errors';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';

@Injectable()
export class GetBagUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
  ) {}

  async execute(barcode: string) {
    // Returns null when bag does not exist.
    // Throws BagNotAtFactoryError when bag exists but is not TAKE_BACK.
    const bag = await this.repo.findBagWithItems(barcode);
    if (!bag) throw new WashBagNotFoundError(barcode);
    return bag;
  }
}
