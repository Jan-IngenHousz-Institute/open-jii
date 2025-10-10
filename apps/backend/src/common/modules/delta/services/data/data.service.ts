import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import * as Arrow from "apache-arrow";

import { Result, success, failure, AppError } from "../../../../utils/fp-utils";
import type { SchemaData } from "../../../databricks/services/sql/sql.types";
import { DeltaConfigService } from "../config/config.service";
import type { DeltaFile, DeltaMetadata } from "../shares/shares.types";

/**
 * Service for processing Delta Sharing data files
 * Handles downloading and parsing Parquet files to convert to SchemaData format
 */
@Injectable()
export class DeltaDataService {
  private readonly logger = new Logger(DeltaDataService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DeltaConfigService,
  ) {}

  /**
   * Process Delta files and metadata to create SchemaData compatible with existing SQL service
   * Downloads and parses Parquet files using Apache Arrow
   */
  async processFiles(
    files: DeltaFile[],
    metadata: DeltaMetadata,
    _limitHint?: number,
  ): Promise<Result<SchemaData>> {
    try {
      this.logger.debug(`Processing ${files.length} Delta files with metadata schema`);

      // Parse the schema string to get column information
      const schema = JSON.parse(metadata.schemaString) as {
        type: string;
        fields: {
          name: string;
          type: string;
          nullable: boolean;
          metadata: Record<string, any>;
        }[];
      };

      // Extract column information
      const columns = schema.fields.map((field) => ({
        name: field.name,
        type_name: field.type,
        type_text: field.type,
      }));

      // Download and parse all Parquet files
      const allRows: (string | null)[][] = [];
      let totalRows = 0;
      let truncated = false;

      for (const file of files) {
        this.logger.debug(`Processing file: ${file.id}`);

        const fileResult = await this.downloadAndParseParquetFile(file);
        if (fileResult.isFailure()) {
          this.logger.warn(`Failed to process file ${file.id}: ${fileResult.error.message}`);
          continue; // Skip failed files but continue processing others
        }

        const fileRows = fileResult.value;
        allRows.push(...fileRows);
        totalRows += fileRows.length;

        // Respect limit hint if provided
        if (_limitHint && totalRows >= _limitHint) {
          truncated = true;
          allRows.splice(_limitHint); // Keep only first limitHint rows
          totalRows = _limitHint;
          break;
        }
      }

      const schemaData: SchemaData = {
        columns,
        rows: allRows,
        totalRows,
        truncated,
      };

      this.logger.debug(
        `Successfully processed ${files.length} files, returning ${totalRows} rows`,
      );
      return success(schemaData);
    } catch (error) {
      this.logger.error("Failed to process Delta files:", error);
      return failure(AppError.internal("Failed to process Delta Sharing data"));
    }
  }

  /**
   * Download and parse a single Parquet file using Apache Arrow
   */
  private async downloadAndParseParquetFile(file: DeltaFile): Promise<Result<(string | null)[][]>> {
    try {
      this.logger.debug(`Downloading and parsing file: ${file.id} from ${file.url}`);

      // Download the Parquet file
      const response = await this.httpService.axiosRef.get(file.url, {
        responseType: "arraybuffer",
        timeout: this.configService.getRequestTimeout(),
      });

      const parquetData = new Uint8Array(response.data as ArrayBuffer);

      // Parse Parquet file with Apache Arrow
      const reader = Arrow.RecordBatchReader.from(parquetData);
      const table = new Arrow.Table(reader);

      // Convert Arrow table to rows format
      const rows: (string | null)[][] = [];

      // Iterate through each row
      for (let rowIndex = 0; rowIndex < table.numRows; rowIndex++) {
        const row: (string | null)[] = [];

        // Iterate through each column
        for (let colIndex = 0; colIndex < table.schema.fields.length; colIndex++) {
          const column = table.getChildAt(colIndex);
          const value: unknown = column?.get(rowIndex);

          // Convert value to string or null for compatibility with SchemaData
          if (value === null || value === undefined) {
            row.push(null);
          } else if (typeof value === "string") {
            row.push(value);
          } else if (typeof value === "number" || typeof value === "boolean") {
            row.push(String(value));
          } else if (value instanceof Date) {
            row.push(value.toISOString());
          } else {
            // For complex types, stringify
            row.push(JSON.stringify(value));
          }
        }

        rows.push(row);
      }

      this.logger.debug(`Successfully parsed file ${file.id}: ${rows.length} rows`);
      return success(rows);
    } catch (error) {
      this.logger.error(`Failed to download/parse file ${file.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return failure(AppError.internal(`Failed to process file ${file.id}: ${errorMessage}`));
    }
  }

  /**
   * Estimate total rows from file stats
   */
  private estimateTotalRows(files: DeltaFile[]): number {
    let totalRows = 0;

    for (const file of files) {
      if (file.stats) {
        try {
          const stats = JSON.parse(file.stats) as { numRecords?: number };
          if (stats.numRecords) {
            totalRows += stats.numRecords;
          }
        } catch {
          // Ignore parsing errors, continue with other files
        }
      }
    }

    return totalRows;
  }

  /**
   * Apply limit hint to files (best effort)
   * Select files until we have enough estimated rows
   */
  applyLimitHint(files: DeltaFile[], limitHint: number): DeltaFile[] {
    if (!limitHint || limitHint <= 0) {
      return files;
    }

    const selectedFiles: DeltaFile[] = [];
    let estimatedRows = 0;

    for (const file of files) {
      selectedFiles.push(file);

      if (file.stats) {
        try {
          const stats = JSON.parse(file.stats) as { numRecords?: number };
          if (stats.numRecords) {
            estimatedRows += stats.numRecords;
            if (estimatedRows >= limitHint) {
              break;
            }
          }
        } catch {
          // Continue with next file if stats parsing fails
        }
      }
    }

    return selectedFiles;
  }
}
