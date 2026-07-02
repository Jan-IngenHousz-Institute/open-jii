import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IsWorkbookUpgradableUseCase } from "../../../../workbooks/application/use-cases/is-workbook-upgradable/is-workbook-upgradable";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
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
    private readonly workbookRepository: WorkbookRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
    private readonly publishVersionUseCase: PublishVersionUseCase,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
  ): Promise<Result<UpgradeWorkbookVersionResult>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can upgrade workbook versions"));
        }

        if (!experiment.workbookId) {
          return failure(
            AppError.badRequest(
              "Experiment does not have an attached workbook. Attach a workbook first.",
            ),
          );
        }

        const workbookResult = await this.workbookRepository.findById(experiment.workbookId);
        if (workbookResult.isFailure()) return workbookResult;
        if (!workbookResult.value) {
          return failure(AppError.notFound(`Workbook with ID ${experiment.workbookId} not found`));
        }

        // Pin to the latest version when nothing's drifted; otherwise mint a
        // new version capturing the current cells.
        const latestResult = await this.workbookVersionRepository.getLatestVersion(
          experiment.workbookId,
        );
        if (latestResult.isFailure()) return latestResult;
        const latest = latestResult.value;

        const upgradableResult = await this.isWorkbookUpgradableUseCase.execute(
          workbookResult.value,
        );
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

        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookVersionId: version.id,
        });

        if (updateResult.isFailure()) {
          return updateResult;
        }

        // Refresh the materialised flow row so mobile reads the new graph.
        const flowGraph = cellsToFlowGraph(version.cells as WorkbookCell[]);
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
      },
    );
  }
}
