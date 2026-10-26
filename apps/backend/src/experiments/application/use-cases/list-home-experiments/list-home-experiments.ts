import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import type { RelatedHomeExperimentRow } from "../../../core/repositories/experiment.repository";

/** The home's fallback for a researcher with no visits yet: their related experiments. */
@Injectable()
export class ListHomeExperimentsUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    limit: number,
  ): Promise<Result<{ experiments: RelatedHomeExperimentRow[] }>> {
    const related = await this.experimentRepository.findRecentlyUpdatedRelated(userId, limit);
    if (related.isFailure()) return related;
    return success({ experiments: related.value });
  }
}
