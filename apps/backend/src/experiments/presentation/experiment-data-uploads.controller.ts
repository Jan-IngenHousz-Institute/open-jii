import {
  Controller,
  HttpCode,
  HttpException,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

import { experimentUploadsContract } from "@repo/api/domains/experiment/uploads/experiment-uploads.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import type { AppError } from "../../common/utils/fp-utils";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ListUploadsUseCase } from "../application/use-cases/experiment-data-uploads/list-uploads";
import { UploadDataUseCase } from "../application/use-cases/experiment-data-uploads/upload-data";

@Controller()
export class ExperimentDataUploadsController {
  private readonly logger = new Logger(ExperimentDataUploadsController.name);

  constructor(
    private readonly uploadDataUseCase: UploadDataUseCase,
    private readonly listUploadsUseCase: ListUploadsUseCase,
  ) {}

  // Native streaming endpoint: the multipart body is piped straight to Databricks
  // without buffering, so it stays off the oRPC contract (oRPC drains the body to
  // materialise File parts). Form fields are validated in-flow against
  // zExperimentUploadFormFields inside UploadDataUseCase.
  @CanAccess({ resource: "experiment", action: "manage" })
  @Post("/api/v1/experiments/:id/data/uploads")
  @HttpCode(201)
  async uploadData(
    @Param("id", ParseUUIDPipe) experimentId: string,
    @Session() session: UserSession,
    @Req() request: Request,
  ) {
    const result = await this.uploadDataUseCase.execute({
      experimentId,
      userId: session.user.id,
      requestStream: request,
      requestHeaders: request.headers,
    });

    if (result.isFailure()) {
      throw this.toHttpException(result.error);
    }

    return {
      uploadId: result.value.uploadId,
      uploadTableId: result.value.uploadTableId,
      uploadTableName: result.value.uploadTableName,
      runId: result.value.runId,
      files: result.value.files,
    };
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentUploadsContract.listUploads)
  listUploads(@Session() session: UserSession) {
    return implement(experimentUploadsContract.listUploads).handler(async ({ input }) => {
      const result = await this.listUploadsUseCase.execute(input.id, session.user.id, {
        uploadTableId: input.uploadTableId,
        uploadTableName: input.uploadTableName,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  private toHttpException(error: AppError): HttpException {
    if (error.statusCode >= 500) {
      this.logger.error({ msg: error.message, errorCode: error.code, operation: "uploadData" });
    } else {
      this.logger.warn({ msg: error.message, errorCode: error.code, operation: "uploadData" });
    }

    return new HttpException({ message: error.message, code: error.code }, error.statusCode);
  }
}
