import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowBindingRepository } from "../../../core/repositories/flow-binding.repository";
import { materializeFlowGraph } from "../materialize-flow-graph";

export interface SetWorkbookVersionResult {
  workbookId: string;
  workbookVersionId: string;
  version: number;
}

/**
 * Pins an experiment to a SPECIFIC existing published version (rollback or
 * roll-forward). Unlike upgrade, it never publishes a new version; the target
 * must already belong to the experiment's workbook.
 */
@Injectable()
export class SetWorkbookVersionUseCase {
  private readonly logger = new Logger(SetWorkbookVersionUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly flowBindingRepository: FlowBindingRepository,
  ) {}

  async execute(
    experimentId: string,
    versionId: string,
    userId: string,
  ): Promise<Result<SetWorkbookVersionResult>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      if (!experiment.workbookId) {
        return failure(
          AppError.badRequest(
            "Experiment does not have an attached workbook. Attach a workbook first.",
          ),
        );
      }

      const versionsResult = await this.workbookVersionRepository.findByWorkbookId(
        experiment.workbookId,
      );
      if (versionsResult.isFailure()) return versionsResult;

      // Restrict the target to a version of THIS experiment's workbook.
      const target = versionsResult.value.find((v) => v.id === versionId);
      if (!target) {
        return failure(
          AppError.notFound(
            `Version ${versionId} does not belong to workbook ${experiment.workbookId}`,
          ),
        );
      }

      // Materialise + strictly validate before any mutation, then re-pin and
      // upsert/delete the flow atomically (both roll back together; a
      // concurrent workbook change is rejected).
      const materialized = materializeFlowGraph(target.cells);
      if (materialized.isFailure()) return materialized;

      const bindResult = await this.flowBindingRepository.bind({
        experimentId,
        expectedWorkbookId: experiment.workbookId,
        pointer: { workbookVersionId: target.id },
        materialization: materialized.value,
      });
      if (bindResult.isFailure()) return bindResult;

      this.logger.log({
        msg: "Experiment pinned to a specific workbook version",
        operation: "setWorkbookVersion",
        experimentId,
        userId,
        workbookId: experiment.workbookId,
        workbookVersionId: target.id,
        version: target.version,
      });

      return success({
        workbookId: experiment.workbookId,
        workbookVersionId: target.id,
        version: target.version,
      });
    });
  }
}
