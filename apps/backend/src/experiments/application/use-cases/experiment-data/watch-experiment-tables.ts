import { Injectable } from "@nestjs/common";

import { AppError, failure } from "../../../../common/utils/fp-utils";
import type { Result } from "../../../../common/utils/fp-utils";
import type {
  ExperimentDataSource,
  ExperimentTablesChange,
} from "../../../core/models/experiment-data.model";
import { ExperimentTableChangesService } from "../../services/experiment-table-changes.service";

@Injectable()
export class WatchExperimentTablesUseCase {
  constructor(private readonly tableChanges: ExperimentTableChangesService) {}

  execute(
    experimentId: string,
    userId: string,
    source: ExperimentDataSource,
    signal?: AbortSignal,
  ): Result<AsyncGenerator<ExperimentTablesChange, void>> {
    if (source !== "store") {
      return failure(AppError.notFound("Table changes are streamed only from the serving store"));
    }

    return this.tableChanges.open(experimentId, userId, signal);
  }
}
