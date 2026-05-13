import { Inject, Injectable } from '@nestjs/common';
import { WASH_REPOSITORY, WashRepository } from '../../domain/wash.repository';
import { PackageView } from '../../domain/wash.types';

@Injectable()
export class CreatePackageUseCase {
  constructor(
    @Inject(WASH_REPOSITORY)
    private readonly repo: WashRepository,
  ) {}

  async execute(): Promise<{ packages: PackageView[] }> {
    const packages = await this.repo.createPackages();
    return { packages };
  }
}
