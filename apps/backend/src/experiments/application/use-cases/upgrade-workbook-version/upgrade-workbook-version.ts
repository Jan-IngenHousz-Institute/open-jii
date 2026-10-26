import { Injectable, Logger } from "@nestjs/common";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { PublishIfDriftedUseCase } from "../../../../workbooks/application/use-cases/publish-if-drifted/publish-if-drifted";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export interface UpgradeWorkbookVersionResult {
  workbookId: string;
  workbookVersionId: string;
  version: number;
}

@Injectable()
export class UpgradeWorkbookVersionUseCase {
  private readonly logger = new Logger(UpgradeWorkbookVersionUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly publishIfDriftedUseCase: PublishIfDriftedUseCase,
    private readonly flowRepository: FlowRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<UpgradeWorkbookVersionResult>> {
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

      // The route guards the experiment; this reads the workbook's current cells.
      // Without a check here, a revoked grantee could still capture the workbook's
      // later state via an experiment they manage. Here, not left to the publish step:
      // reusing the latest version never reaches PublishVersionUseCase.
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

      const versionResult = await this.publishIfDriftedUseCase.execute(
        experiment.workbookId,
        userId,
        { forExperimentId: experimentId },
      );
      if (versionResult.isFailure()) return versionResult;
      const version = versionResult.value;

      const updateResult = await this.experimentRepository.update(experimentId, {
        workbookVersionId: version.id,
      });

      if (updateResult.isFailure()) {
        return updateResult;
      }

      // Refresh the materialised flow row so mobile reads the new graph.
      const flowGraph = cellsToFlowGraph(version.cells);
      const flowResult = await this.flowRepository.upsert(experimentId, flowGraph);
      if (flowResult.isFailure()) {
        return flowResult;
      }

      this.logger.log({
        msg: "Workbook version upgraded on experiment",
        operation: "upgradeWorkbookVersion",
        experimentId,
        workbookId: experiment.workbookId,
        workbookVersionId: version.id,
        version: version.version,
      });

      return success({
        workbookId: experiment.workbookId,
        workbookVersionId: version.id,
        version: version.version,
      });
    });
  }
}
