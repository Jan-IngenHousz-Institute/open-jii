import { Injectable, Logger } from "@nestjs/common";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

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
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    versionId: string,
    userId: string,
  ): Promise<Result<SetWorkbookVersionResult>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can change the workbook version"));
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

        // Refresh the materialised flow row first, then re-pin. If the flow
        // upsert fails, the experiment stays on the old (consistent) version
        // rather than pointing at a version whose flow never updated.
        const flowResult = await this.flowRepository.upsert(
          experimentId,
          cellsToFlowGraph(target.cells),
        );
        if (flowResult.isFailure()) return flowResult;

        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookVersionId: target.id,
        });
        if (updateResult.isFailure()) return updateResult;

        this.logger.log({
          msg: "Experiment pinned to a specific workbook version",
          operation: "setWorkbookVersion",
          experimentId,
          workbookId: experiment.workbookId,
          workbookVersionId: target.id,
          version: target.version,
        });

        return success({
          workbookId: experiment.workbookId,
          workbookVersionId: target.id,
          version: target.version,
        });
      },
    );
  }
}
