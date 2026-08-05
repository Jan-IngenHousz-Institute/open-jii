import { Injectable, Logger } from "@nestjs/common";

import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IsWorkbookUpgradableUseCase } from "../../../../workbooks/application/use-cases/is-workbook-upgradable/is-workbook-upgradable";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

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
    private readonly workbookRepository: WorkbookRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
    private readonly publishVersionUseCase: PublishVersionUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    experimentId: string,
    expectedWorkbookId: string,
    expectedWorkbookVersionId: string,
    expectedWorkbookRevision: number,
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
      // later state via an experiment they manage. Before both branches: the
      // pin-existing path never reaches PublishVersionUseCase.
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

      const workbookResult = await this.workbookRepository.findById(experiment.workbookId);
      if (workbookResult.isFailure()) return workbookResult;
      if (!workbookResult.value) {
        return failure(AppError.notFound(`Workbook with ID ${experiment.workbookId} not found`));
      }
      if (workbookResult.value.revision !== expectedWorkbookRevision) {
        return failure(
          AppError.conflict(
            "Someone else changed this workbook. Refresh to review their changes before publishing.",
            "WORKBOOK_REVISION_CONFLICT",
          ),
        );
      }

      // Pin to the latest version when nothing's drifted; otherwise mint a
      // new version capturing the current cells.
      const latestResult = await this.workbookVersionRepository.getLatestVersion(
        experiment.workbookId,
      );
      if (latestResult.isFailure()) return latestResult;
      const latest = latestResult.value;

      const upgradableResult = await this.isWorkbookUpgradableUseCase.execute(workbookResult.value);
      if (upgradableResult.isFailure()) return upgradableResult;

      let version: WorkbookVersionDto;
      if (latest && !upgradableResult.value) {
        version = latest;
      } else {
        const versionResult = await this.publishVersionUseCase.execute(
          experiment.workbookId,
          userId,
        );
        if (versionResult.isFailure()) return versionResult;
        version = versionResult.value;
      }

      if (version.workbookId !== experiment.workbookId) {
        return failure(
          AppError.notFound(
            `No valid workbook version found for workbook ${experiment.workbookId}`,
          ),
        );
      }

      const flowGraph = cellsToFlowGraph(version.cells);
      const updateResult = await this.experimentRepository.updateWorkbookAndFlowIfExpected(
        experimentId,
        { workbookId: expectedWorkbookId, workbookVersionId: expectedWorkbookVersionId },
        { workbookVersionId: version.id },
        flowGraph,
        { workbookId: expectedWorkbookId, revision: expectedWorkbookRevision },
      );

      if (updateResult.isFailure()) {
        return updateResult;
      }
      if (!updateResult.value) {
        return failure(
          AppError.conflict(
            "The experiment's linked workbook changed. Refresh and try again.",
            "WORKBOOK_SCOPE_CHANGED",
          ),
        );
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
