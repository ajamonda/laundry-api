import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogRepository,
} from '../../domain/catalog.repository';

@Injectable()
export class GetCatalogItemDetailUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: CatalogRepository,
  ) {}

  async execute(itemCode: string) {
    const item = await this.catalogRepository.findActiveItemByCode(itemCode);
    if (!item) {
      throw new NotFoundException(`Catalog item not found: ${itemCode}`);
    }

    return item;
  }
}
