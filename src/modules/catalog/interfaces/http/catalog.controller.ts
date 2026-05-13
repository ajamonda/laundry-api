import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetCatalogItemDetailUseCase } from '../../application/use-cases/get-catalog-item-detail.use-case';
import { GetCatalogItemsUseCase } from '../../application/use-cases/get-catalog-items.use-case';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly getCatalogItemsUseCase: GetCatalogItemsUseCase,
    private readonly getCatalogItemDetailUseCase: GetCatalogItemDetailUseCase,
  ) {}

  @Get('items')
  getItems() {
    return this.getCatalogItemsUseCase.execute();
  }

  @Get('items/:itemCode')
  getItem(@Param('itemCode') itemCode: string) {
    return this.getCatalogItemDetailUseCase.execute(itemCode);
  }
}
