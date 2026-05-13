import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogRepository,
} from '../../domain/catalog.repository';
import { EstimateItemInput } from '../../domain/catalog.types';

@Injectable()
export class EstimatePricingUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: CatalogRepository,
  ) {}

  execute(items: EstimateItemInput[]) {
    return this.catalogRepository.estimateItems(items);
  }
}
