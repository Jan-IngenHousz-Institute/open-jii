import { Injectable } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { IsWorkbookUpgradableUseCase } from "../is-workbook-upgradable/is-workbook-upgradable";
import { PublishVersionUseCase } from "../publish-version/publish-version";

/**
 * The version that matches the workbook's draft: the latest one when nothing has
 * drifted since it, otherwise a new one. Reusing it is what keeps a repeated attach,
 * upgrade or publish from creating a duplicate version and telling every experiment
 * about it again.
 */
@Injectable()
export class PublishIfDriftedUseCase {
  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
    private readonly publishVersionUseCase: PublishVersionUseCase,
  ) {}

  async execute(
    workbookId: string,
    userId: string,
    options?: { forExperimentId?: string },
  ): Promise<Result<WorkbookVersionDto>> {
    const workbookResult = await this.workbookRepository.findById(workbookId);
    if (workbookResult.isFailure()) return workbookResult;
    if (!workbookResult.value) {
      return failure(AppError.notFound(`Workbook with ID ${workbookId} not found`));
    }

    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbookId);
    if (latestResult.isFailure()) return latestResult;

    const upgradableResult = await this.isWorkbookUpgradableUseCase.execute(workbookResult.value);
    if (upgradableResult.isFailure()) return upgradableResult;

    if (latestResult.value && !upgradableResult.value) {
      return success(latestResult.value);
    }

    return this.publishVersionUseCase.execute(workbookId, userId, options);
  }
}
