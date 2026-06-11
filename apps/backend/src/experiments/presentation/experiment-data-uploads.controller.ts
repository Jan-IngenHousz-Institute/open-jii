import { Controller, Logger, Req } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import type { Request } from "express";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { handleFailure } from "../../common/utils/fp-utils";
import { ListUploadsUseCase } from "../application/use-cases/experiment-data-uploads/list-uploads";
import { UploadDataUseCase } from "../application/use-cases/experiment-data-uploads/upload-data";

@Controller()
export class ExperimentDataUploadsController {
  private readonly logger = new Logger(ExperimentDataUploadsController.name);

  constructor(
    private readonly uploadDataUseCase: UploadDataUseCase,
    private readonly listUploadsUseCase: ListUploadsUseCase,
  ) {}

  @TsRestHandler(contract.experiments.uploadData)
  uploadData(@Session() session: UserSession, @Req() request: Request) {
    return tsRestHandler(contract.experiments.uploadData, async ({ params }) => {
      // sourceKind is read from the multipart form by the use case.
      const result = await this.uploadDataUseCase.execute({
        experimentId: params.id,
        userId: session.user.id,
        requestStream: request,
        requestHeaders: request.headers,
      });
      if (result.isFailure()) {
        return handleFailure(result, this.logger);
      }
      return {
        status: StatusCodes.CREATED,
        body: {
          uploadId: result.value.uploadId,
          uploadTableId: result.value.uploadTableId,
          uploadTableName: result.value.uploadTableName,
          runId: result.value.runId,
          files: result.value.files,
        },
      };
    });
  }

  @TsRestHandler(contract.experiments.listUploads)
  listUploads(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listUploads, async ({ params, query }) => {
      const result = await this.listUploadsUseCase.execute(params.id, session.user.id, {
        uploadTableId: query.uploadTableId,
        uploadTableName: query.uploadTableName,
      });
      if (result.isFailure()) {
        return handleFailure(result, this.logger);
      }
      return { status: StatusCodes.OK, body: result.value };
    });
  }
}
