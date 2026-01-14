import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { DATABRICKS_FILE_FAILED } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { UploadFileResponse } from "./files.types";

@Injectable()
export class DatabricksFilesService {
  private readonly logger = new Logger(DatabricksFilesService.name);

  public static readonly FILES_ENDPOINT = "/api/2.0/fs/files";

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Upload a file to a specified path in Databricks workspace.
   * The caller is responsible for constructing the full path.
   *
   * @param filePath - The full destination path for the file in Databricks.
   * @param fileBuffer - File contents as a buffer.
   * @returns Result containing file ID and path.
   */
  async upload(filePath: string, fileBuffer: Buffer): Promise<Result<UploadFileResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksFilesService.FILES_ENDPOINT}`;

        this.logger.debug({
          msg: "Uploading file to Databricks",
          operation: "uploadFile",
          context: DatabricksFilesService.name,
          filePath,
        });

        const fullPath = `${apiUrl}${filePath}`;

        await this.httpService.axiosRef.put(fullPath, fileBuffer, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          params: {
            overwrite: false,
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log({
          msg: "Successfully uploaded file to Databricks",
          operation: "uploadFile",
          context: DatabricksFilesService.name,
          filePath,
          status: "success",
        });

        return {
          filePath,
        };
      },
      (error) => {
        this.logger.error({
          msg: "Failed to upload file to Databricks",
          errorCode: DATABRICKS_FILE_FAILED,
          operation: "uploadFile",
          context: DatabricksFilesService.name,
          error,
        });
        return apiErrorMapper(
          `Failed to upload file to Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }
}
