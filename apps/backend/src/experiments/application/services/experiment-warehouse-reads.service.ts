import { Inject, Injectable } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../core/models/experiment-data.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import type {
  ExperimentTableReads,
  TableQuery,
} from "../../core/ports/experiment-table-reads.port";

/** Reads through the warehouse's views, which join contributors, devices and annotations. */
@Injectable()
export class ExperimentWarehouseReadsService implements ExperimentTableReads {
  readonly picksLargePagesById = true;

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  readsTable(): boolean {
    return true;
  }

  tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    return this.databricksPort.getExperimentTableMetadata(experimentId, { includeSchemas: true });
  }

  viewColumns(tableType: ExperimentTableType, identifier: string): Promise<Result<string[]>> {
    return this.databricksPort.getExperimentTableColumns(tableType, identifier);
  }

  buildQuery(params: ExperimentQueryParams): Promise<Result<TableQuery>> {
    const built = this.databricksPort.buildExperimentQuery(params);
    if (built.isFailure()) {
      return Promise.resolve(built);
    }
    return Promise.resolve(
      success({ sql: built.value, columns: [], distinct: params.distinct ?? false }),
    );
  }

  countQuery(query: TableQuery): TableQuery {
    return {
      sql: `SELECT COUNT(*) AS total FROM (${query.sql}) AS sub`,
      columns: [],
      distinct: false,
    };
  }

  runQuery(query: TableQuery): Promise<Result<SchemaData>> {
    return this.databricksPort.executeSqlQuery(this.databricksPort.CENTRUM_SCHEMA_NAME, query.sql);
  }
}
