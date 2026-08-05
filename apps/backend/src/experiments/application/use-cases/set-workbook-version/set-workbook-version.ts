import { Injectable, Logger } from "@nestjs/common";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

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
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    experimentId: string,
    versionId: string,
    expectedWorkbookId: string,
    expectedWorkbookVersionId: string,
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
      if (
        experiment.workbookId !== expectedWorkbookId ||
        experiment.workbookVersionId !== expectedWorkbookVersionId
      ) {
        return failure(
          AppError.conflict(
            "The experiment's linked workbook changed. Refresh and try again.",
            "WORKBOOK_SCOPE_CHANGED",
          ),
        );
      }

      // The route only guards experiment `manage`, and pinning materialises the
      // target version's cells into the experiment's flow. So someone who manages
      // the experiment but has lost read access to the workbook could otherwise
      // select a version published after their grant went away and capture its
      // contents. Check before the versions are loaded, so no workbook state is read
      // on the way to the refusal.
      const workbookAccess = await this.authz.can(userId, {
        resourceType: "workbook",
        resourceId: experiment.workbookId,
        action: "read",
      });
      if (!workbookAccess.allow) {
        return failure(
          workbookAccess.reason === "not-found"
            ? AppError.notFound(`Workbook with ID ${experiment.workbookId} not found`)
            : AppError.forbidden("You do not have access to this workbook"),
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

      const updateResult = await this.experimentRepository.updateWorkbookAndFlowIfExpected(
        experimentId,
        { workbookId: expectedWorkbookId, workbookVersionId: expectedWorkbookVersionId },
        { workbookVersionId: target.id },
        cellsToFlowGraph(target.cells),
      );
      if (updateResult.isFailure()) return updateResult;
      if (!updateResult.value) {
        return failure(
          AppError.conflict(
            "The experiment's linked workbook changed. Refresh and try again.",
            "WORKBOOK_SCOPE_CHANGED",
          ),
        );
      }

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
