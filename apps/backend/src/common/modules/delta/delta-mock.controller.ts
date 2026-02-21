import { Controller, Get, Param, Query, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { join } from "path";

import type { Result } from "../../utils/fp-utils";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { DeltaDataService } from "./services/data/data.service";

/**
 * Mock controller for local Delta / Parquet development.
 * No auth, no Delta Sharing protocol — reads parquet files directly from disk.
 *
 * Place parquet fixture files in the `fixtures/` directory next to this file,
 * named `{tableName}.parquet` (e.g. `experiment_raw_data.parquet`).
 *
 * Endpoints:
 *   GET /delta-mock/tables/:tableName           — all data (paginated)
 *   GET /delta-mock/tables/:tableName/columns    — subset of columns
 *   GET /delta-mock/tables/:tableName/count      — row count
 */
@AllowAnonymous()
@Controller("delta-mock")
export class DeltaMockController {
  private readonly logger = new Logger(DeltaMockController.name);
  private readonly fixturesDir: string;

  constructor(private readonly dataService: DeltaDataService) {
    // Fixtures live in the source tree — use cwd (project root) to resolve
    // Override via DELTA_MOCK_FIXTURES_DIR env var
    this.fixturesDir =
      process.env.DELTA_MOCK_FIXTURES_DIR ??
      join(process.cwd(), "src", "common", "modules", "delta", "fixtures");
  }

  /**
   * GET /delta-mock/tables/:tableName
   * Returns paginated data from the local parquet file.
   */
  @Get("tables/:tableName")
  async getTableData(
    @Param("tableName") tableName: string,
    @Query("page") pageStr?: string,
    @Query("pageSize") pageSizeStr?: string,
    @Query("columns") columnsStr?: string,
  ): Promise<SchemaData> {
    const page = Math.max(parseInt(pageStr ?? "1", 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(pageSizeStr ?? "100", 10) || 100, 1), 10_000);
    const columns = columnsStr ? columnsStr.split(",").map((c) => c.trim()) : undefined;

    const filePath = this.resolveParquetPath(tableName);
    this.logger.debug(`Mock table data: ${tableName} (page=${page}, pageSize=${pageSize})`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result: Result<SchemaData> = await this.dataService.readLocalParquetFile(filePath, {
      columns,
      rowStart: (page - 1) * pageSize,
      rowEnd: page * pageSize,
    });

    if (result.isFailure()) {
      throw new HttpException(result.error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result.value;
  }

  /**
   * GET /delta-mock/tables/:tableName/columns?names=col1,col2
   * Returns only requested columns from the local parquet file.
   */
  @Get("tables/:tableName/columns")
  async getTableColumns(
    @Param("tableName") tableName: string,
    @Query("names") namesStr?: string,
  ): Promise<SchemaData> {
    if (!namesStr) {
      throw new HttpException(
        "Query param 'names' is required (comma-separated)",
        HttpStatus.BAD_REQUEST,
      );
    }

    const columns = namesStr.split(",").map((c) => c.trim());
    const filePath = this.resolveParquetPath(tableName);
    this.logger.debug(`Mock table columns: ${tableName} -> [${columns.join(", ")}]`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result: Result<SchemaData> = await this.dataService.readLocalParquetFile(filePath, {
      columns,
    });

    if (result.isFailure()) {
      throw new HttpException(result.error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return result.value;
  }

  /**
   * GET /delta-mock/tables/:tableName/count
   * Returns the total row count from parquet metadata (no full scan).
   */
  @Get("tables/:tableName/count")
  async getTableRowCount(@Param("tableName") tableName: string): Promise<{ totalRows: number }> {
    const filePath = this.resolveParquetPath(tableName);
    this.logger.debug(`Mock table count: ${tableName}`);

    // Read with rowEnd=0 to avoid loading actual data, just metadata
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const result: Result<SchemaData> = await this.dataService.readLocalParquetFile(filePath, {
      rowEnd: 0,
    });

    if (result.isFailure()) {
      throw new HttpException(result.error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return { totalRows: result.value.totalRows };
  }

  private resolveParquetPath(tableName: string): string {
    // Sanitise to prevent path traversal
    const safe = tableName.replace(/[^a-zA-Z0-9_-]/g, "");
    return join(this.fixturesDir, `${safe}.parquet`);
  }
}
