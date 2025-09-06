import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper, AppError } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { CreateDirectoryResponse, UploadFileResponse } from "./files.types";

@Injectable()
export class DatabricksFilesService {
  private readonly logger = new Logger(DatabricksFilesService.name);

  public static readonly FILES_ENDPOINT = "/api/2.0/fs/files";
  public static readonly DIRECTORIES_ENDPOINT = "/api/2.0/fs/directories";

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

        this.logger.debug(`Uploading file to Databricks at path ${filePath}`);

        const fullPath = `${apiUrl}${filePath}`;

        await this.httpService.axiosRef.put(fullPath, fileBuffer, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          params: {
            overwrite: true,
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log(`Successfully uploaded file to Databricks at path ${filePath}`);

        return {
          filePath,
        };
      },
      (error) => {
        this.logger.error(`Failed to upload file to Databricks: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(
          `Failed to upload file to Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }

  /**
   * Create a directory at the specified path in Databricks workspace.
   *
   * @param directoryPath - The full path for the directory to create in Databricks.
   * @returns Result containing the created directory path.
   */
  async createDirectory(directoryPath: string): Promise<Result<CreateDirectoryResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksFilesService.DIRECTORIES_ENDPOINT}`;

        this.logger.debug(`Creating directory in Databricks at path ${directoryPath}`);

        const fullPath = `${apiUrl}${directoryPath}`;

        await this.httpService.axiosRef.put(fullPath, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log(`Successfully created directory in Databricks at path ${directoryPath}`);

        return {
          directoryPath,
        };
      },
      (error) => {
        this.logger.error(
          `Failed to create directory in Databricks: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(
          `Failed to create directory in Databricks: ${getAxiosErrorMessage(error)}`,
        );
      },
    );
  }
}
