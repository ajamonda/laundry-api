import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOG_REPOSITORY,
  CatalogRepository,
} from '../../domain/catalog.repository';

@Injectable()
export class GetCatalogItemsUseCase {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: CatalogRepository,
  ) {}

  execute() {
    return this.catalogRepository.findActiveItems();
  }
}
