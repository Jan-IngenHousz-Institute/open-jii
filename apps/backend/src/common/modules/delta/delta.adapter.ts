import { Injectable, Logger } from "@nestjs/common";

import type { DeltaPort } from "../../../experiments/core/ports/delta.port";
import { Result, success, failure } from "../../utils/fp-utils";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import type { ListTablesResponse } from "../databricks/services/tables/tables.types";
import { DeltaConfigService } from "./services/config/config.service";
import { DeltaDataService } from "./services/data/data.service";
import { DeltaSharesService } from "./services/shares/shares.service";
import type { Table } from "./services/shares/shares.types";
import { DeltaTablesService } from "./services/tables/tables.service";

@Injectable()
export class DeltaAdapter implements DeltaPort {
  private readonly logger = new Logger(DeltaAdapter.name);

  constructor(
    private readonly configService: DeltaConfigService,
    private readonly sharesService: DeltaSharesService,
    private readonly tablesService: DeltaTablesService,
    private readonly dataService: DeltaDataService,
  ) {}

  /**
   * List tables available for an experiment using Delta Sharing
   * Uses the configured share and centrum schema
   */
  async listTables(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<ListTablesResponse>> {
    const shareName = this.configService.getShareName();
    const schemaName = this.configService.getSchemaName();

    this.logger.debug(
      `Listing tables for experiment ${experimentId} using share: ${shareName}.${schemaName}`,
    );

    const tablesResult = await this.sharesService.listTables(shareName, schemaName);

    if (tablesResult.isFailure()) {
      return failure(tablesResult.error);
    }

    // Convert Delta Sharing table format to Databricks format for compatibility
    const compatibleTables = tablesResult.value.items.map((table: Table) => ({
      name: table.name,
      catalog_name: table.share,
      schema_name: table.schema,
      table_type: "TABLE",
      created_at: Date.now(), // Use current timestamp as placeholder
    }));

    return success({
      tables: compatibleTables,
    });
  }

  /**
   * Get data from a table using Delta Sharing with pagination support
   */
  async getTableData(
    experimentName: string,
    experimentId: string,
    tableName: string,
    page = 1,
    pageSize = 100,
  ): Promise<Result<SchemaData>> {
    const shareName = this.configService.getShareName();
    const schemaName = this.configService.getSchemaName();

    this.logger.debug(
      `Getting table data for ${tableName} in experiment ${experimentId} (page ${page}, size ${pageSize})`,
    );

    // Query all files to get accurate total row count
    const queryResult = await this.tablesService.queryTable(shareName, schemaName, tableName, {});

    if (queryResult.isFailure()) {
      return failure(queryResult.error);
    }

    const allFiles = queryResult.value.files;
    const estimatedTotal = this.dataService.estimateTotalRows(allFiles);

    // Apply client-side pagination using file selection
    const selectedFiles = this.dataService.applyLimitHint(allFiles, pageSize);

    // Process the files to create SchemaData
    const result = await this.dataService.processFiles(
      selectedFiles,
      queryResult.value.metadata,
      pageSize,
    );

    // Fix totalRows to reflect the full table, not just the returned page
    if (result.isSuccess()) {
      result.value.totalRows = estimatedTotal;
      result.value.truncated = estimatedTotal > result.value.rows.length;
    }

    return result;
  }

  /**
   * Get specific columns from a table using Delta Sharing
   */
  async getTableColumns(
    experimentName: string,
    experimentId: string,
    tableName: string,
    columns: string[],
  ): Promise<Result<SchemaData>> {
    const shareName = this.configService.getShareName();
    const schemaName = this.configService.getSchemaName();

    this.logger.debug(
      `Getting columns [${columns.join(", ")}] from table ${tableName} in experiment ${experimentId}`,
    );

    // Query the table — use limitHint=0 to keep it light, no row limit needed here
    const queryResult = await this.tablesService.queryTable(shareName, schemaName, tableName, {});

    if (queryResult.isFailure()) {
      return failure(queryResult.error);
    }

    // Process files with column selection pushed into hyparquet
    return await this.dataService.processFiles(
      queryResult.value.files,
      queryResult.value.metadata,
      undefined,
      { columns },
    );
  }

  /**
   * Get the total row count for a table
   */
  async getTableRowCount(
    experimentName: string,
    experimentId: string,
    tableName: string,
  ): Promise<Result<number>> {
    const shareName = this.configService.getShareName();
    const schemaName = this.configService.getSchemaName();

    this.logger.debug(`Getting row count for table ${tableName} in experiment ${experimentId}`);

    const queryResult = await this.tablesService.queryTable(shareName, schemaName, tableName, {});

    if (queryResult.isFailure()) {
      return failure(queryResult.error);
    }

    // Delegate to data service to avoid duplicating stats-parsing logic
    const totalRows = this.dataService.estimateTotalRows(queryResult.value.files);
    return success(totalRows);
  }

  /**
   * Check if a table exists in the experiment
   */
  async tableExists(
    experimentName: string,
    experimentId: string,
    tableName: string,
  ): Promise<Result<boolean>> {
    const tablesResult = await this.listTables(experimentName, experimentId);

    if (tablesResult.isFailure()) {
      return failure(tablesResult.error);
    }

    const exists = tablesResult.value.tables.some((table) => table.name === tableName);
    return success(exists);
  }
}
