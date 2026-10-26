import { Injectable, Logger } from "@nestjs/common";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { PublishIfDriftedUseCase } from "../../../../workbooks/application/use-cases/publish-if-drifted/publish-if-drifted";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export interface AttachWorkbookResult {
  workbookId: string;
  workbookVersionId: string;
  version: number;
}

@Injectable()
export class AttachWorkbookUseCase {
  private readonly logger = new Logger(AttachWorkbookUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly publishIfDriftedUseCase: PublishIfDriftedUseCase,
    private readonly flowRepository: FlowRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    experimentId: string,
    workbookId: string,
    userId: string,
  ): Promise<Result<AttachWorkbookResult>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) {
        return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
      }

      // The route only guards `manage` on the experiment; the workbook is a
      // client-supplied cross-resource reference, so require the caller to be
      // able to read it — a dynamic cross-resource reference is checked here rather
      // than by the route guard. Otherwise a private workbook could be materialised into the
      // caller's experiment flow without a grant.
      const workbookAccess = await this.authz.can(userId, {
        resourceType: "workbook",
        resourceId: workbookId,
        action: "read",
      });
      if (!workbookAccess.allow) {
        return failure(
          workbookAccess.reason === "not-found"
            ? AppError.notFound(`Workbook with ID ${workbookId} not found`)
            : AppError.forbidden("You do not have access to this workbook"),
        );
      }

      const versionResult = await this.publishIfDriftedUseCase.execute(workbookId, userId, {
        forExperimentId: experimentId,
      });
      if (versionResult.isFailure()) return versionResult;
      const version = versionResult.value;

      const updateResult = await this.experimentRepository.update(experimentId, {
        workbookId,
        workbookVersionId: version.id,
      });

      if (updateResult.isFailure()) {
        return updateResult;
      }

      // Materialise a flow row from the version's cells; mobile still reads from `flows`.
      const flowGraph = cellsToFlowGraph(version.cells);
      const flowResult = await this.flowRepository.upsert(experimentId, flowGraph);
      if (flowResult.isFailure()) {
        return flowResult;
      }

      this.logger.log({
        msg: "Workbook attached to experiment",
        operation: "attachWorkbook",
        experimentId,
        workbookId,
        workbookVersionId: version.id,
        version: version.version,
      });

      return success({
        workbookId,
        workbookVersionId: version.id,
        version: version.version,
      });
    });
  }
}
