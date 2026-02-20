import { Controller, Logger, StreamableFile } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { handleFailure } from "../../common/utils/fp-utils";
import { DownloadExportUseCase } from "../application/use-cases/experiment-data-exports/download-export";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";

@Controller()
export class ExperimentDataExportsController {
  private readonly logger = new Logger(ExperimentDataExportsController.name);

  constructor(
    private readonly initiateExportUseCase: InitiateExportUseCase,
    private readonly listExportsUseCase: ListExportsUseCase,
    private readonly downloadExportUseCase: DownloadExportUseCase,
  ) {}

  @TsRestHandler(contract.experiments.initiateExport)
  initiateExport(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.initiateExport, async ({ params, body }) => {
      const { id: experimentId } = params;
      const { tableName, format } = body;

      this.logger.log({
        msg: "Processing initiate export request",
        operation: "initiateExport",
        experimentId,
        userId: session.user.id,
        tableName,
        format,
      });

      const result = await this.initiateExportUseCase.execute(experimentId, session.user.id, {
        tableName,
        format,
      });

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Export initiated successfully",
          operation: "initiateExport",
          experimentId,
          tableName,
          format,
          status: "success",
        });

        return {
          status: StatusCodes.CREATED,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.listExports)
  listExports(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExports, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { tableName } = query;

      this.logger.log({
        msg: "Processing list exports request",
        operation: "listExports",
        experimentId,
        userId: session.user.id,
        tableName,
      });

      const result = await this.listExportsUseCase.execute(experimentId, session.user.id, {
        tableName,
      });

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Exports listed successfully",
          operation: "listExports",
          experimentId,
          tableName,
          count: result.value.exports.length,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.downloadExport)
  downloadExport(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.downloadExport, async ({ params }) => {
      const { id: experimentId, exportId } = params;

      this.logger.log({
        msg: "Processing download export request",
        operation: "downloadExport",
        experimentId,
        exportId,
        userId: session.user.id,
      });

      const result = await this.downloadExportUseCase.execute(
        experimentId,
        exportId,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Export download successful",
          operation: "downloadExport",
          exportId,
          filename: result.value.filename,
          status: "success",
        });

        const { stream, filename } = result.value;
        return {
          status: StatusCodes.OK,
          body: new StreamableFile(stream, {
            type: "application/octet-stream",
            disposition: `attachment; filename="${filename}"`,
          }),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
