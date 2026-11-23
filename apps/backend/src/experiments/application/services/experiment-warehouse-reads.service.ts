import { Inject, Injectable } from "@nestjs/common";

import { SqlQueryBuilder } from "../../../common/modules/databricks/services/query-builder/query-builder.base";
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
import { NumberAnswersService } from "./number-answers.service";

/** Reads through the warehouse's views, which join contributors, devices and annotations. */
@Injectable()
export class ExperimentWarehouseReadsService implements ExperimentTableReads {
  readonly picksLargePagesById = true;
  readonly listsTablesAfresh = false;

  constructor(
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly numberAnswers: NumberAnswersService,
  ) {}

  readsTable(): boolean {
    return true;
  }

  async tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    const metadata = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      includeSchemas: true,
    });
    if (metadata.isFailure()) {
      return metadata;
    }
    return this.numberAnswers.typed(experimentId, metadata.value);
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

  deviceLabelsQuery(query: TableQuery, limit: number, offset: number): TableQuery {
    return {
      ...query,
      sql: new SqlQueryBuilder()
        .select(["serial_number"])
        .distinct()
        .from(`(${query.sql}) AS device_names`)
        .where("`serial_number` IS NOT NULL AND trim(`serial_number`) <> ''")
        .orderByRaw("lower(`serial_number`) ASC, `serial_number` ASC")
        .limit(limit)
        .offset(offset)
        .build(),
      distinct: true,
    };
  }

  runQuery(query: TableQuery): Promise<Result<SchemaData>> {
    return this.databricksPort.executeSqlQuery(this.databricksPort.CENTRUM_SCHEMA_NAME, query.sql);
  }
}
