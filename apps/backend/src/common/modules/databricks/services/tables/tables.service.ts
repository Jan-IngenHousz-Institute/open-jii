import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { ListTablesResponse } from "./tables.types";

@Injectable()
export class DatabricksTablesService {
  private readonly logger = new Logger(DatabricksTablesService.name);

  public static readonly TABLES_ENDPOINT = "/api/2.1/unity-catalog/tables";

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: DatabricksAuthService,
    private readonly configService: DatabricksConfigService,
  ) {}

  async listTables(schemaName: string): Promise<Result<ListTablesResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksTablesService.TABLES_ENDPOINT}`;

        this.logger.debug(`Listing tables for schema ${schemaName}`);

        const response = await this.httpService.axiosRef.get<ListTablesResponse>(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            catalog_name: this.configService.getCatalogName(),
            schema_name: schemaName,
            omit_columns: false, // Include column information in the response
          },
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        return {
          next_page_token: response.data.next_page_token,
          tables: response.data.tables.map((table) => ({
            name: table.name,
            catalog_name: table.catalog_name,
            schema_name: table.schema_name,
            table_type: table.table_type,
            comment: table.comment,
            created_at: table.created_at,
            columns: table.columns,
            properties: table.properties,
          })),
        };
      },
      (error) => {
        this.logger.error(`Failed to list tables: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(`Failed to list Databricks tables: ${getAxiosErrorMessage(error)}`);
      },
    );
  }
}
