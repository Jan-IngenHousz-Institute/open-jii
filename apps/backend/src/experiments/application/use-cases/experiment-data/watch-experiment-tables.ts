import { Injectable } from "@nestjs/common";

import { AppError, failure, success } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import type {
  ExperimentDataSource,
  ExperimentTablesChange,
} from "../../../core/models/experiment-data.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentTableChangesService } from "../../services/experiment-table-changes.service";

@Injectable()
export class WatchExperimentTablesUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly tableChanges: ExperimentTableChangesService,
  ) {}

  async execute(
    experimentId: string,
    source: ExperimentDataSource,
    signal?: AbortSignal,
  ): Promise<Result<AsyncGenerator<ExperimentTablesChange, void>>> {
    if (source !== "store") {
      return failure(AppError.notFound("Table changes are streamed only from the serving store"));
    }

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    return success(this.tableChanges.listen(experimentId, signal));
  }
}
