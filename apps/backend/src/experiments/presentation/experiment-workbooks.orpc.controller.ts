import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentWorkbooksOrpcContract } from "@repo/api/domains/experiment/experiment-workbooks.orpc";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AttachWorkbookUseCase } from "../application/use-cases/attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "../application/use-cases/detach-workbook/detach-workbook";
import { UpgradeWorkbookVersionUseCase } from "../application/use-cases/upgrade-workbook-version/upgrade-workbook-version";

@Controller()
export class ExperimentWorkbooksOrpcController {
  private readonly logger = new Logger(ExperimentWorkbooksOrpcController.name);

  constructor(
    private readonly attachWorkbookUseCase: AttachWorkbookUseCase,
    private readonly detachWorkbookUseCase: DetachWorkbookUseCase,
    private readonly upgradeWorkbookVersionUseCase: UpgradeWorkbookVersionUseCase,
  ) {}

  @Implement(experimentWorkbooksOrpcContract.attachWorkbook)
  attachWorkbook(@Session() session: UserSession) {
    return implement(experimentWorkbooksOrpcContract.attachWorkbook).handler(async ({ input }) => {
      const result = await this.attachWorkbookUseCase.execute(input.id, input.workbookId, session.user.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentWorkbooksOrpcContract.detachWorkbook)
  detachWorkbook(@Session() session: UserSession) {
    return implement(experimentWorkbooksOrpcContract.detachWorkbook).handler(async ({ input }) => {
      const result = await this.detachWorkbookUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentWorkbooksOrpcContract.upgradeWorkbookVersion)
  upgradeWorkbookVersion(@Session() session: UserSession) {
    return implement(experimentWorkbooksOrpcContract.upgradeWorkbookVersion).handler(async ({ input }) => {
      const result = await this.upgradeWorkbookVersionUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
