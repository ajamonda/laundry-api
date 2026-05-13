import { Inject, Injectable } from '@nestjs/common';
import { ActorContext } from '../../../processing-route/domain/processing-route.types';
import { ExceptionItemNotFoundError, ItemNotIssuableError } from '../../domain/exception.errors';
import { EXCEPTION_REPOSITORY, ExceptionRepository } from '../../domain/exception.repository';
import { RaiseIssueResult } from '../../domain/exception.types';

const ISSUABLE_STATUSES = ['SORTED', 'PROCESSING'];

@Injectable()
export class RaiseIssueUseCase {
  constructor(
    @Inject(EXCEPTION_REPOSITORY)
    private readonly repo: ExceptionRepository,
  ) {}

  async execute(input: {
    itemId: string;
    issueType: string;
    note: string | null;
    actor: ActorContext;
  }): Promise<RaiseIssueResult> {
    const item = await this.repo.findItemStatus(input.itemId);
    if (!item) throw new ExceptionItemNotFoundError(input.itemId);
    if (!ISSUABLE_STATUSES.includes(item.status)) {
      throw new ItemNotIssuableError(input.itemId);
    }

    const issue = await this.repo.createIssue({
      itemId: input.itemId,
      issueType: input.issueType,
      note: input.note,
      actor: input.actor,
    });

    return { issue };
  }
}
