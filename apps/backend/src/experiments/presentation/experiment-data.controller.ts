import {
  Controller,
  HttpStatus,
  Logger,
  ParseFilePipeBuilder,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data";
import { UploadAmbyteDataUseCase } from "../application/use-cases/experiment-data/upload-ambyte-data";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly uploadAmbyteDataUseCase: UploadAmbyteDataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@CurrentUser() user: { id: string }) {
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

  @TsRestHandler(contract.experiments.uploadExperimentData)
  @UseInterceptors(
    FilesInterceptor("files", 100, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit per file
      },
    }),
  )
  uploadExperimentData(
    @CurrentUser() user: { id: string },
    @UploadedFiles(
      new ParseFilePipeBuilder().build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        fileIsRequired: true,
      }),
    )
    files: Express.Multer.File[],
  ) {
    return tsRestHandler(contract.experiments.uploadExperimentData, async ({ params, body }) => {
      const { id: experimentId } = params;
      const { sourceType } = body;

      if (files.length === 0) {
        return {
          status: StatusCodes.BAD_REQUEST,
          body: {
            message: "No files uploaded",
          },
        };
      }

      this.logger.log(
        `Processing ${sourceType} data upload for experiment ${experimentId} by user ${user.id} (${files.length} files)`,
      );

      // Call the use case with all files
      const result = await this.uploadAmbyteDataUseCase.execute(experimentId, user.id, files);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
