import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  ImportWorkspaceObjectRequest,
  ImportWorkspaceObjectResponse,
  DeleteWorkspaceObjectRequest,
  DeleteWorkspaceObjectResponse,
  WorkspaceObjectFormat,
} from "./workspace.types";

@Injectable()
export class DatabricksWorkspaceService {
  private readonly logger = new Logger(DatabricksWorkspaceService.name);

  public static readonly WORKSPACE_IMPORT_ENDPOINT = "/api/2.0/workspace/import";
  public static readonly WORKSPACE_DELETE_ENDPOINT = "/api/2.0/workspace/delete";

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Import a workspace object (notebook or file) to Databricks workspace
   * @param request - Import request parameters
   * @returns Result containing the import response
   */
  async importWorkspaceObject(
    request: ImportWorkspaceObjectRequest,
  ): Promise<Result<ImportWorkspaceObjectResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksWorkspaceService.WORKSPACE_IMPORT_ENDPOINT}`;

        this.logger.debug(`Importing workspace object to path: ${request.path}`);

        const requestBody = {
          content: request.content,
          format: request.format ?? WorkspaceObjectFormat.SOURCE,
          language: request.language,
          overwrite: request.overwrite ?? false,
          path: request.path,
        };

        await this.httpService.axiosRef.post(apiUrl, requestBody, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log(`Successfully imported workspace object to path: ${request.path}`);

        return {};
      },
      (error) => {
        this.logger.error(
          `Failed to import workspace object to path ${request.path}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(`Failed to import workspace object: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Delete a workspace object (notebook or directory) from Databricks workspace
   * @param request - Delete request parameters
   * @returns Result containing the delete response
   */
  async deleteWorkspaceObject(
    request: DeleteWorkspaceObjectRequest,
  ): Promise<Result<DeleteWorkspaceObjectResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksWorkspaceService.WORKSPACE_DELETE_ENDPOINT}`;

        this.logger.debug(`Deleting workspace object at path: ${request.path}`);

        const requestBody = {
          path: request.path,
          recursive: request.recursive ?? false,
        };

        await this.httpService.axiosRef.post(apiUrl, requestBody, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        this.logger.log(`Successfully deleted workspace object at path: ${request.path}`);

        return {};
      },
      (error) => {
        this.logger.error(
          `Failed to delete workspace object at path ${request.path}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(`Failed to delete workspace object: ${getAxiosErrorMessage(error)}`);
      },
    );
  }
}
