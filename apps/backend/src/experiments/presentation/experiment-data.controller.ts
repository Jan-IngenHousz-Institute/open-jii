import { Controller, Logger, UseGuards } from "@nestjs/common";
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
  uploadExperimentData(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.uploadExperimentData, async ({ params, body }) => {
      const { id: experimentId } = params;
      const { sourceType, file } = body;

      this.logger.log(
        `Processing ${sourceType} data upload for experiment ${experimentId} by user ${user.id}`,
      );

      // Validate that file data is a Buffer
      if (!Buffer.isBuffer(file.data)) {
        return {
          status: StatusCodes.BAD_REQUEST,
          body: {
            success: false,
            message: "Invalid file format. Ambyte data must be uploaded as a Buffer.",
          },
        };
      }

      // With only ambyte support, we don't need to check the sourceType since schema ensures it's "ambyte"
      const result = await this.uploadAmbyteDataUseCase.execute(
        experimentId,
        user.id,
        file.name,
        file.data,
      );

      if (result.isSuccess()) {
        const uploadData = result.value;

        this.logger.log(`Successfully uploaded ambyte data file to experiment ${experimentId}`);

        return {
          status: StatusCodes.CREATED,
          body: {
            success: true,
            message: `Successfully uploaded Ambyte data file "${file.name}"`,
            uploadId: uploadData.fileId,
          },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
