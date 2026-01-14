import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { DATABRICKS_VOLUME_FAILED } from "../../../../utils/error-codes";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { CreateVolumeParams, GetVolumeParams, VolumeResponse } from "./volumes.types";

@Injectable()
export class DatabricksVolumesService {
  private readonly logger = new Logger(DatabricksVolumesService.name);

  public static readonly VOLUMES_ENDPOINT = "/api/2.1/unity-catalog/volumes";

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DatabricksConfigService,
    private readonly authService: DatabricksAuthService,
  ) {}

  /**
   * Creates a new volume in Databricks Unity Catalog.
   *
   * The user could create either an external volume or a managed volume. An external volume will be created
   * in the specified external location, while a managed volume will be located in the default location
   * which is specified by the parent schema, or the parent catalog, or the Metastore.
   *
   * For the volume creation to succeed, the user must satisfy following conditions:
   * - The caller must be a metastore admin, or be the owner of the parent catalog and schema, or have the
   *   USE_CATALOG privilege on the parent catalog and the USE_SCHEMA privilege on the parent schema.
   * - The caller must have CREATE VOLUME privilege on the parent schema.
   *
   * For an external volume, following conditions also need to satisfy:
   * - The caller must have CREATE EXTERNAL VOLUME privilege on the external location.
   * - There are no other tables, nor volumes existing in the specified storage location.
   * - The specified storage location is not under the location of other tables, nor volumes, or catalogs or schemas.
   *
   * @param params Parameters for creating a volume
   * @returns A result containing the created volume information
   */
  async createVolume(params: CreateVolumeParams): Promise<Result<VolumeResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const volumesUrl = `${host}${DatabricksVolumesService.VOLUMES_ENDPOINT}`;

        this.logger.debug(
          `Creating ${params.volume_type} volume '${params.name}' in ${params.catalog_name}.${params.schema_name}`,
        );

        const response: AxiosResponse<VolumeResponse> = await this.httpService.axiosRef.post(
          volumesUrl,
          params,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const volumeResponse = response.data;
        this.logger.log(
          `Successfully created volume '${volumeResponse.full_name}' with ID ${volumeResponse.volume_id}`,
        );

        return volumeResponse;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to create volume",
          errorCode: DATABRICKS_VOLUME_FAILED,
          operation: "createVolume",
          context: DatabricksVolumesService.name,
          error,
        });
        return apiErrorMapper(`Failed to create volume: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Gets a volume from the metastore for a specific catalog and schema.
   *
   * The caller must be a metastore admin or an owner of (or have the READ VOLUME privilege on) the volume.
   * For the latter case, the caller must also be the owner or have the USE_CATALOG privilege on the parent
   * catalog and the USE_SCHEMA privilege on the parent schema.
   *
   * @param params Parameters for getting a volume
   * @returns A result containing the volume information
   */
  async getVolume(params: GetVolumeParams): Promise<Result<VolumeResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const volumeUrl = `${host}${DatabricksVolumesService.VOLUMES_ENDPOINT}/${encodeURIComponent(params.name)}`;

        // Add include_browse query parameter if provided
        const queryParams = params.include_browse ? `?include_browse=${params.include_browse}` : "";
        const fullUrl = `${volumeUrl}${queryParams}`;

        this.logger.debug({
          msg: "Getting volume information",
          operation: "getVolume",
          context: DatabricksVolumesService.name,
          volumeName: params.name,
        });

        const response: AxiosResponse<VolumeResponse> = await this.httpService.axiosRef.get(
          fullUrl,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const volumeResponse = response.data;
        this.logger.log(
          `Successfully retrieved volume '${volumeResponse.full_name}' with ID ${volumeResponse.volume_id}`,
        );

        return volumeResponse;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to get volume",
          errorCode: DATABRICKS_VOLUME_FAILED,
          operation: "getVolume",
          context: DatabricksVolumesService.name,
          error,
        });
        return apiErrorMapper(`Failed to get volume: ${getAxiosErrorMessage(error)}`);
      },
    );
  }
}
