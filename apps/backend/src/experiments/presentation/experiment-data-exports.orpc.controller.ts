import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Readable } from "stream";

import { experimentExportsOrpcContract } from "@repo/api/domains/experiment/experiment-exports.orpc";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { DownloadExportUseCase } from "../application/use-cases/experiment-data-exports/download-export";
import { InitiateExportUseCase } from "../application/use-cases/experiment-data-exports/initiate-export";
import { ListExportsUseCase } from "../application/use-cases/experiment-data-exports/list-exports";

@Controller()
export class ExperimentDataExportsOrpcController {
  private readonly logger = new Logger(ExperimentDataExportsOrpcController.name);

  constructor(
    private readonly initiateExportUseCase: InitiateExportUseCase,
    private readonly listExportsUseCase: ListExportsUseCase,
    private readonly downloadExportUseCase: DownloadExportUseCase,
  ) {}

  @Implement(experimentExportsOrpcContract.initiateExport)
  initiateExport(@Session() session: UserSession) {
    return implement(experimentExportsOrpcContract.initiateExport).handler(async ({ input }) => {
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

  @Implement(experimentExportsOrpcContract.listExports)
  listExports(@Session() session: UserSession) {
    return implement(experimentExportsOrpcContract.listExports).handler(async ({ input }) => {
      const result = await this.listExportsUseCase.execute(input.id, session.user.id, {
        tableName: input.tableName,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentExportsOrpcContract.downloadExport)
  downloadExport(@Session() session: UserSession) {
    return implement(experimentExportsOrpcContract.downloadExport).handler(async ({ input }) => {
      const result = await this.downloadExportUseCase.execute(
        input.id,
        input.exportId,
        session.user.id,
      );

      if (result.isSuccess()) {
        const { stream, filename } = result.value;
        return this.toDownloadFile(stream, filename);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  private async toDownloadFile(stream: Readable, filename: string): Promise<File> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Buffer));
    }
    return new File([Buffer.concat(chunks)], filename, { type: "application/octet-stream" });
  }
}
