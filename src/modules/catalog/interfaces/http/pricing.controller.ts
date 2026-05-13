import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EstimatePricingUseCase } from '../../application/use-cases/estimate-pricing.use-case';
import { PricingEstimateRequestDto } from './dto/pricing-estimate.dto';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly estimatePricingUseCase: EstimatePricingUseCase) {}

  @Post('estimate')
  estimate(@Body() body: PricingEstimateRequestDto) {
    return this.estimatePricingUseCase.execute(body.items);
  }
}
