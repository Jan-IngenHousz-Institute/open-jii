import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Readable } from "stream";

import { experimentExportsContract } from "@repo/api/domains/experiment/exports/experiment-exports.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
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

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentExportsContract.downloadExport)
  downloadExport(@Session() session: UserSession) {
    return implement(experimentExportsContract.downloadExport).handler(async ({ input }) => {
      const result = await this.downloadExportUseCase.execute(
        input.id,
        input.exportId,
        session.user.id,
      );

      if (result.isSuccess()) {
        const { stream, filename, format } = result.value;
        return this.toDownloadFile(stream, filename, format);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  private async toDownloadFile(
    stream: Readable,
    filename: string,
    format: ExportFormat,
  ): Promise<File> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    return new File([Buffer.concat(chunks)], filename, { type: DOWNLOAD_CONTENT_TYPES[format] });
  }
}
