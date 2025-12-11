import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, AppError, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  DatabricksPipelineByNameParams,
  DatabricksPipelineGetParams,
  DatabricksPipelineListParams,
  DatabricksPipelineListResponse,
  DatabricksPipelineResponse,
  DatabricksPipelineStartUpdateParams,
  DatabricksPipelineStartUpdateResponse,
} from "./pipelines.types";

@Injectable()
export class DatabricksPipelinesService {
  private readonly logger = new Logger(DatabricksPipelinesService.name);

  public static readonly PIPELINES_ENDPOINT = "/api/2.0/pipelines";

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: DatabricksAuthService,
    private readonly configService: DatabricksConfigService,
  ) {}

  /**
   * List pipelines
   * @param params Optional parameters for the list pipelines request
   * @returns List of pipelines
   */
  async listPipelines(
    params?: DatabricksPipelineListParams,
  ): Promise<Result<DatabricksPipelineListResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;

        const host = this.configService.getHost();
        const pipelinesUrl = `${host}${DatabricksPipelinesService.PIPELINES_ENDPOINT}`;

        this.logger.debug("Listing Databricks pipelines");

        // Prepare request parameters
        const requestParams: Record<string, string | number> = {};
        if (params?.maxResults) {
          requestParams.max_results = params.maxResults;
        }
        if (params?.pageToken) {
          requestParams.page_token = params.pageToken;
        }
        if (params?.filter) {
          requestParams.filter = params.filter;
        }

        const listResult = await tryCatch(
          async () => {
            const response: AxiosResponse<DatabricksPipelineListResponse> =
              await this.httpService.axiosRef.get(pipelinesUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                params: requestParams,
                timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
              });

            const listResponse = response.data;
            this.logger.log(
              `Successfully retrieved ${listResponse.statuses.length} Databricks pipelines`,
            );

            return listResponse;
          },
          (error) => {
            this.logger.error(`Error listing pipelines: ${getAxiosErrorMessage(error)}`);
            return apiErrorMapper(`Databricks pipeline list: ${getAxiosErrorMessage(error)}`);
          },
        );

        if (listResult.isFailure()) {
          throw listResult.error;
        }

        return listResult.value;
      },
      (error) => {
        this.logger.error(`Failed to list Databricks pipelines: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(`Databricks pipelines list: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Get pipeline by name
   * @param params Parameters containing the pipeline name
   * @returns Pipeline information if found
   */
  async getPipelineByName(
    params: DatabricksPipelineByNameParams,
  ): Promise<Result<DatabricksPipelineResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;

        // Get the list of pipelines
        const host = this.configService.getHost();
        const pipelinesUrl = `${host}${DatabricksPipelinesService.PIPELINES_ENDPOINT}`;

        this.logger.debug("Listing Databricks pipelines");

        const listResult = await tryCatch(
          async () => {
            const response: AxiosResponse<DatabricksPipelineListResponse> =
              await this.httpService.axiosRef.get(pipelinesUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                params: {
                  max_results: 100, // Use a reasonable default
                },
                timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
              });

            const listResponse = response.data;
            this.logger.log(
              `Successfully retrieved ${listResponse.statuses.length} Databricks pipelines`,
            );

            return listResponse;
          },
          (error) => {
            this.logger.error(`Error listing pipelines: ${getAxiosErrorMessage(error)}`);
            return apiErrorMapper(`Databricks pipeline list: ${getAxiosErrorMessage(error)}`);
          },
        );

        if (listResult.isFailure()) {
          throw listResult.error;
        }

        const pipelinesList = listResult.value;

        // Find the pipeline with the specified name
        const targetPipeline = pipelinesList.statuses.find(
          (pipeline) => pipeline.name === params.pipelineName,
        );

        if (!targetPipeline) {
          this.logger.warn(`Pipeline with name '${params.pipelineName}' not found`);
          throw AppError.notFound(`Pipeline with name '${params.pipelineName}' not found`);
        }

        // Get the details of the found pipeline
        const pipelineUrl = `${host}${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${targetPipeline.pipeline_id}`;

        this.logger.debug(`Getting Databricks pipeline: ${targetPipeline.pipeline_id}`);

        const getResult = await tryCatch(
          async () => {
            const response: AxiosResponse<DatabricksPipelineResponse> =
              await this.httpService.axiosRef.get(pipelineUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
              });

            const pipelineResponse = response.data;

            if (!pipelineResponse.pipeline_id) {
              throw AppError.internal("Invalid response from Databricks API: missing pipeline_id");
            }

            this.logger.log(
              `Successfully retrieved Databricks pipeline: ${pipelineResponse.pipeline_id}`,
            );

            return pipelineResponse;
          },
          (error) => {
            this.logger.error(`Error getting pipeline: ${getAxiosErrorMessage(error)}`);
            return apiErrorMapper(`Databricks pipeline get: ${getAxiosErrorMessage(error)}`);
          },
        );

        if (getResult.isFailure()) {
          throw getResult.error;
        }

        return getResult.value;
      },
      (error) => {
        this.logger.error(
          `Failed to get Databricks pipeline by name: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(`Databricks pipeline get by name: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Get details about a pipeline
   * @param params Parameters for the get pipeline request
   * @returns Pipeline information
   */
  async getPipeline(
    params: DatabricksPipelineGetParams,
  ): Promise<Result<DatabricksPipelineResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;

        const host = this.configService.getHost();
        const pipelineUrl = `${host}${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${params.pipelineId}`;

        this.logger.debug(`Getting Databricks pipeline: ${params.pipelineId}`);

        const result = await tryCatch(
          async () => {
            const response: AxiosResponse<DatabricksPipelineResponse> =
              await this.httpService.axiosRef.get(pipelineUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
              });

            const pipelineResponse = response.data;

            if (!pipelineResponse.pipeline_id) {
              throw AppError.internal("Invalid response from Databricks API: missing pipeline_id");
            }

            this.logger.log(
              `Successfully retrieved Databricks pipeline: ${pipelineResponse.pipeline_id}`,
            );

            return pipelineResponse;
          },
          (error) => {
            this.logger.error(`Error getting pipeline: ${getAxiosErrorMessage(error)}`);
            return apiErrorMapper(`Databricks pipeline get: ${getAxiosErrorMessage(error)}`);
          },
        );

        if (result.isFailure()) {
          throw result.error;
        }

        return result.value;
      },
      (error) => {
        this.logger.error(`Failed to get Databricks pipeline: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(`Databricks pipeline get: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Start an update for a pipeline
   * @param params Parameters for the start update request
   * @returns Information about the started update
   */
  async startPipelineUpdate(
    params: DatabricksPipelineStartUpdateParams,
  ): Promise<Result<DatabricksPipelineStartUpdateResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;

        const host = this.configService.getHost();
        const updateUrl = `${host}${DatabricksPipelinesService.PIPELINES_ENDPOINT}/${params.pipelineId}/updates`;

        this.logger.debug(`Starting update for Databricks pipeline: ${params.pipelineId}`);

        // Prepare request body based on provided parameters
        const requestBody: Record<string, unknown> = {};

        if (params.cause !== undefined) {
          requestBody.cause = params.cause;
        }

        if (params.fullRefresh !== undefined) {
          requestBody.full_refresh = params.fullRefresh;
        }

        if (params.fullRefreshSelection !== undefined && params.fullRefreshSelection.length > 0) {
          requestBody.full_refresh_selection = params.fullRefreshSelection;
        }

        if (params.refreshSelection !== undefined && params.refreshSelection.length > 0) {
          requestBody.refresh_selection = params.refreshSelection;
        }

        if (params.validateOnly !== undefined) {
          requestBody.validate_only = params.validateOnly;
        }

        const result = await tryCatch(
          async () => {
            const response: AxiosResponse<DatabricksPipelineStartUpdateResponse> =
              await this.httpService.axiosRef.post(updateUrl, requestBody, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
              });

            const updateResponse = response.data;

            if (!updateResponse.update_id) {
              throw AppError.internal("Invalid response from Databricks API: missing update_id");
            }

            this.logger.log(
              `Successfully started update for Databricks pipeline ${params.pipelineId}, update ID: ${updateResponse.update_id}`,
            );

            return updateResponse;
          },
          (error) => {
            this.logger.error(`Error starting pipeline update: ${getAxiosErrorMessage(error)}`);
            return apiErrorMapper(
              `Databricks pipeline start update: ${getAxiosErrorMessage(error)}`,
            );
          },
        );

        if (result.isFailure()) {
          throw result.error;
        }

        return result.value;
      },
      (error) => {
        this.logger.error(
          `Failed to start Databricks pipeline update: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(`Databricks pipeline start update: ${getAxiosErrorMessage(error)}`);
      },
    );
  }
}
