import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentWorkbooksContract } from "@repo/api/domains/experiment/workbooks/experiment-workbooks.contract";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AttachWorkbookUseCase } from "../application/use-cases/attach-workbook/attach-workbook";
import { DetachWorkbookUseCase } from "../application/use-cases/detach-workbook/detach-workbook";
import { UpgradeWorkbookVersionUseCase } from "../application/use-cases/upgrade-workbook-version/upgrade-workbook-version";

@Controller()
export class ExperimentWorkbooksController {
  private readonly logger = new Logger(ExperimentWorkbooksController.name);

  constructor(
    private readonly attachWorkbookUseCase: AttachWorkbookUseCase,
    private readonly detachWorkbookUseCase: DetachWorkbookUseCase,
    private readonly upgradeWorkbookVersionUseCase: UpgradeWorkbookVersionUseCase,
  ) {}

  @Implement(experimentWorkbooksContract.attachWorkbook)
  attachWorkbook(@Session() session: UserSession) {
    return implement(experimentWorkbooksContract.attachWorkbook).handler(async ({ input }) => {
      const result = await this.attachWorkbookUseCase.execute(
        input.id,
        input.workbookId,
        session.user.id,
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentWorkbooksContract.detachWorkbook)
  detachWorkbook(@Session() session: UserSession) {
    return implement(experimentWorkbooksContract.detachWorkbook).handler(async ({ input }) => {
      const result = await this.detachWorkbookUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentWorkbooksContract.upgradeWorkbookVersion)
  upgradeWorkbookVersion(@Session() session: UserSession) {
    return implement(experimentWorkbooksContract.upgradeWorkbookVersion).handler(
      async ({ input }) => {
        const result = await this.upgradeWorkbookVersionUseCase.execute(input.id, session.user.id);
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
