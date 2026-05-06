import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IsWorkbookUpgradableUseCase } from "../../../../workbooks/application/use-cases/is-workbook-upgradable/is-workbook-upgradable";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
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
    private readonly workbookRepository: WorkbookRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
    private readonly publishVersionUseCase: PublishVersionUseCase,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    workbookId: string,
    userId: string,
  ): Promise<Result<AttachWorkbookResult>> {
    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);

    return accessResult.chain(
      async ({ experiment, isAdmin }: { experiment: ExperimentDto | null; isAdmin: boolean }) => {
        if (!experiment) {
          return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
        }

        if (!isAdmin) {
          return failure(AppError.forbidden("Only admins can attach workbooks to experiments"));
        }

        const workbookResult = await this.workbookRepository.findById(workbookId);
        if (workbookResult.isFailure()) return workbookResult;
        if (!workbookResult.value) {
          return failure(AppError.notFound(`Workbook with ID ${workbookId} not found`));
        }

        // Pin to the latest version when nothing's drifted; otherwise mint a
        // new version so the experiment captures the current cells.
        const latestResult = await this.workbookVersionRepository.getLatestVersion(workbookId);
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
          const versionResult = await this.publishVersionUseCase.execute(workbookId, userId);
          if (versionResult.isFailure()) return versionResult;
          version = versionResult.value;
        }

        const updateResult = await this.experimentRepository.update(experimentId, {
          workbookId,
          workbookVersionId: version.id,
        });

        if (updateResult.isFailure()) {
          return updateResult;
        }

        // Materialise a flow row from the version's cells; mobile still reads from `flows`.
        const flowGraph = cellsToFlowGraph(version.cells as WorkbookCell[]);
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
      },
    );
  }
}
