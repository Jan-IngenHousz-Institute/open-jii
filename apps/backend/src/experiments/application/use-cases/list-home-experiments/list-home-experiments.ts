import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import type {
  RecentlyOpenedExperimentRow,
  RelatedHomeExperimentRow,
} from "../../../core/repositories/experiment.repository";

export type HomeExperimentsResult =
  | { source: "recently-opened"; experiments: RecentlyOpenedExperimentRow[] }
  | { source: "related"; experiments: RelatedHomeExperimentRow[] };

@Injectable()
export class ListHomeExperimentsUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(userId: string, limit: number): Promise<Result<HomeExperimentsResult>> {
    const visits = await this.experimentRepository.findRecentlyOpened(userId, limit, "related");
    if (visits.isFailure()) return visits;
    if (visits.value.length > 0) {
      return success({ source: "recently-opened", experiments: visits.value });
    }

    const related = await this.experimentRepository.findRecentlyUpdatedRelated(userId, limit);
    if (related.isFailure()) return related;
    return success({ source: "related", experiments: related.value });
  }
}
