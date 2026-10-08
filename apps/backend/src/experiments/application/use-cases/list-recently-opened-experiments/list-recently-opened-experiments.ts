import { Injectable, Logger } from "@nestjs/common";

import type { ResourceScope } from "@repo/api/shared/listing";

import { Result } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import type { RecentlyOpenedExperimentRow } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListRecentlyOpenedExperimentsUseCase {
  private readonly logger = new Logger(ListRecentlyOpenedExperimentsUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    limit: number,
    scope?: ResourceScope,
  ): Promise<Result<RecentlyOpenedExperimentRow[]>> {
    this.logger.log({
      msg: "Listing recently opened experiments",
      operation: "listRecentlyOpened",
      userId,
      limit,
      scope,
    });

    const result = await this.experimentRepository.findRecentlyOpened(userId, limit, scope);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to list recently opened experiments",
        errorCode: result.error.code,
        operation: "listRecentlyOpened",
        userId,
      });
    }
    return result;
  }
}
