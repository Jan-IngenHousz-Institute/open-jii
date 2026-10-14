import { Controller, Get, HttpException, Logger, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { pipeline } from "stream";

import { experimentExportsContract } from "@repo/api/domains/experiment/exports/experiment-exports.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import type { AppError } from "../../common/utils/fp-utils";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { DownloadExportUseCase } from "../application/use-cases/experiment-data-exports/download-export";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";
import type { ExportFormat } from "../core/models/experiment-data-exports.model";

// Text formats compress on the way out; Parquet and XLSX are already compressed.
const DOWNLOAD_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv",
  ndjson: "application/x-ndjson",
  "json-array": "application/json",
  parquet: "application/vnd.apache.parquet",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

@Controller()
export class ExperimentDataExportsController {
  private readonly logger = new Logger(ExperimentDataExportsController.name);

  constructor(
    private readonly initiateExportUseCase: InitiateExportUseCase,
    private readonly listExportsUseCase: ListExportsUseCase,
    private readonly downloadExportUseCase: DownloadExportUseCase,
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

  // Native streaming endpoint: the Databricks file is piped to the client a chunk at a time, so it
  // stays off the oRPC contract (oRPC holds File outputs in memory). pipeline() aborts the response
  // when Databricks fails partway and closes the Databricks stream when the client goes away.
  @CanAccess({ resource: "experiment", action: "read" })
  @Get("/api/v1/experiments/:id/data/exports/:exportId")
  async downloadExport(
    @Param("id", ParseUUIDPipe) experimentId: string,
    @Param("exportId", ParseUUIDPipe) exportId: string,
    @Session() session: UserSession,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.downloadExportUseCase.execute(
      experimentId,
      exportId,
      session.user.id,
    );

    if (result.isFailure()) {
      throw this.toHttpException(result.error);
    }

    const { stream, contentLength, filename, format } = result.value;

    // buildExportFilename only emits [a-z0-9_.-], so the name needs no quoting.
    response.setHeader("Content-Type", DOWNLOAD_CONTENT_TYPES[format]);
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (contentLength !== undefined) {
      response.setHeader("Content-Length", contentLength);
    }

    pipeline(stream, response, (error) => {
      if (error) {
        this.logger.warn({
          msg: "Export download stream ended early",
          operation: "downloadExport",
          experimentId,
          exportId,
          error: String(error),
        });
      }
    });
  }

  private toHttpException(error: AppError): HttpException {
    if (error.statusCode >= 500) {
      this.logger.error({ msg: error.message, errorCode: error.code, operation: "downloadExport" });
    } else {
      this.logger.warn({ msg: error.message, errorCode: error.code, operation: "downloadExport" });
    }

    return new HttpException({ message: error.message, code: error.code }, error.statusCode);
  }
}
