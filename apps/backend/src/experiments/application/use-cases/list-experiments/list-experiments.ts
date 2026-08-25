import { Injectable, Logger } from "@nestjs/common";

import type {
  ExperimentFilter,
  ExperimentFlowMeta,
  ExperimentStatus,
} from "@repo/api/domains/experiment/experiment.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";
import { deriveExperimentFlowMeta } from "@repo/api/transforms/experiment-flow-meta";

import { AppError, Result, success } from "../../../../common/utils/fp-utils";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

type ExperimentListItemDto = ExperimentDto & { flowMeta: ExperimentFlowMeta | null };

@Injectable()
export class ListExperimentsUseCase {
  private readonly logger = new Logger(ListExperimentsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
  ) {}

  async execute(
    userId: string,
    filter?: ExperimentFilter,
    status?: ExperimentStatus,
    search?: string,
  ): Promise<Result<ExperimentListItemDto[]>> {
    this.logger.log({
      msg: "Listing experiments",
      operation: "list",
      userId,
      filter,
      status,
      search,
    });

    const result = await this.experimentRepository.findAll(userId, filter, status, search);
    if (result.isFailure()) {
      this.logFailure(userId, result.error);
      return result;
    }

    const versionIds = [
      ...new Set(
        result.value
          .map((experiment) => experiment.workbookVersionId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const cellsResult = await this.workbookVersionRepository.findCellsByIds(versionIds);
    if (cellsResult.isFailure()) {
      this.logFailure(userId, cellsResult.error);
      return cellsResult;
    }

    const experiments = result.value.map((experiment): ExperimentListItemDto => {
      const cells = experiment.workbookVersionId
        ? cellsResult.value.get(experiment.workbookVersionId)
        : undefined;
      return {
        ...experiment,
        flowMeta: cells ? deriveExperimentFlowMeta(cellsToFlowGraph(cells)) : null,
      };
    });

    this.logger.debug({
      msg: "Found experiments",
      operation: "list",
      userId,
      count: experiments.length,
    });

    return success(experiments);
  }

  private logFailure(userId: string, error: AppError): void {
    this.logger.error({
      msg: "Failed to list experiments",
      errorCode: error.code,
      operation: "list",
      userId,
      error,
    });
  }
}
