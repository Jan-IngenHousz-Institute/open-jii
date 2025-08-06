import { Controller, Logger, UseGuards, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data";
import { UploadDataUseCase } from "../application/use-cases/upload-data/upload-data";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly uploadDataUseCase: UploadDataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.getExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;
      const { page, pageSize, tableName } = query;

      this.logger.log(`Processing data request for experiment ${experimentId} by user ${user.id}`);

      const result = await this.getExperimentDataUseCase.execute(experimentId, user.id, {
        page,
        pageSize,
        tableName,
      });

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log(`Successfully retrieved data for experiment ${experimentId}`);

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.uploadData)
  @UseInterceptors(FileInterceptor('file'))
  uploadData(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    return tsRestHandler(contract.experiments.uploadData, async ({ params, body }) => {
      const { id: experimentId } = params;
      const { sensorFamily } = body;

      this.logger.log(`Processing upload request for experiment ${experimentId} by user ${user.id}`);

      if (!file) {
        return {
          status: StatusCodes.BAD_REQUEST,
          body: {
            error: "BadRequest",
            message: "No file uploaded",
            statusCode: StatusCodes.BAD_REQUEST,
          },
        };
      }

      const result = await this.uploadDataUseCase.execute({
        experimentId,
        userId: user.id,
        sensorFamily,
        file: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype,
      });

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log(`Successfully processed upload for experiment ${experimentId}`);

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
