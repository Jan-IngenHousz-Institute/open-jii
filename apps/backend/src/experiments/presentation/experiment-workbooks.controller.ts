import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
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

  @TsRestHandler(contract.experiments.attachWorkbook)
  attachWorkbook(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.attachWorkbook, async ({ params, body }) => {
      const result = await this.attachWorkbookUseCase.execute(
        params.id,
        body.workbookId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.detachWorkbook)
  detachWorkbook(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.detachWorkbook, async ({ params }) => {
      const result = await this.detachWorkbookUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.upgradeWorkbookVersion)
  upgradeWorkbookVersion(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.upgradeWorkbookVersion, async ({ params }) => {
      const result = await this.upgradeWorkbookVersionUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
