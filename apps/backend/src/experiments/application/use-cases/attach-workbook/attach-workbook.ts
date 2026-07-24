import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { IsWorkbookUpgradableUseCase } from "../../../../workbooks/application/use-cases/is-workbook-upgradable/is-workbook-upgradable";
import { PublishVersionUseCase } from "../../../../workbooks/application/use-cases/publish-version/publish-version";
import type { WorkbookVersionDto } from "../../../../workbooks/core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowBindingRepository } from "../../../core/repositories/flow-binding.repository";
import { materializeFlowGraph } from "../materialize-flow-graph";

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
    private readonly flowBindingRepository: FlowBindingRepository,
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

      const upgradableResult = await this.isWorkbookUpgradableUseCase.execute(workbookResult.value);
      if (upgradableResult.isFailure()) return upgradableResult;

      let version: WorkbookVersionDto;
      if (latest && !upgradableResult.value) {
        version = latest;
      } else {
        const versionResult = await this.publishVersionUseCase.execute(workbookId, userId);
        if (versionResult.isFailure()) return versionResult;
        version = versionResult.value;
      }

      if (version.workbookId !== workbookId) {
        return failure(
          AppError.notFound(`No valid workbook version found for workbook ${workbookId}`),
        );
      }

      const updateResult = await this.experimentRepository.update(experimentId, {
        workbookId,
        workbookVersionId: version.id,
      });

      if (updateResult.isFailure()) {
        return updateResult;
      }

      // Materialise + strictly validate before any mutation, then re-point
      // and upsert/delete the flow atomically (rolls back together; rejects a
      // concurrent workbook change). The published version may end unreferenced.
      const materialized = materializeFlowGraph(version.cells);
      if (materialized.isFailure()) return materialized;

      const bindResult = await this.flowBindingRepository.bind({
        experimentId,
        expectedWorkbookId: experiment.workbookId ?? null,
        pointer: { workbookId, workbookVersionId: version.id },
        materialization: materialized.value,
      });
      if (bindResult.isFailure()) return bindResult;

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
