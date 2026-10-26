import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentExportsContract } from "@repo/api/domains/experiment/exports/experiment-exports.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetExportDownloadLinksUseCase } from "../application/use-cases/experiment-data-exports/get-export-download-links";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";

@Controller()
export class ExperimentDataExportsController {
  private readonly logger = new Logger(ExperimentDataExportsController.name);

  constructor(
    private readonly initiateExportUseCase: InitiateExportUseCase,
    private readonly listExportsUseCase: ListExportsUseCase,
    private readonly getExportDownloadLinksUseCase: GetExportDownloadLinksUseCase,
  ) {}

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentExportsContract.initiateExport)
  initiateExport(@Session() session: UserSession) {
    return implement(experimentExportsContract.initiateExport).handler(async ({ input }) => {
      const { id: experimentId, tableName, format, anonymizeContributors } = input;

      const result = await this.initiateExportUseCase.execute(experimentId, session.user.id, {
        tableName,
        format,
        anonymizeContributors,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentExportsContract.listExports)
  listExports(@Session() session: UserSession) {
    return implement(experimentExportsContract.listExports).handler(async ({ input }) => {
      const result = await this.listExportsUseCase.execute(input.id, session.user.id, {
        tableName: input.tableName,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentExportsContract.getExportDownloadLinks)
  getExportDownloadLinks() {
    return implement(experimentExportsContract.getExportDownloadLinks).handler(
      async ({ input }) => {
        const result = await this.getExportDownloadLinksUseCase.execute(input.id, input.exportId);

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
