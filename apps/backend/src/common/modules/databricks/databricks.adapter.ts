import { Injectable } from "@nestjs/common";

import { DatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { Result } from "../../utils/fp-utils";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type {
  DatabricksJobTriggerParams,
  DatabricksJobRunResponse,
} from "./services/jobs/jobs.types";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData } from "./services/sql/sql.types";
import { DatabricksTablesService } from "./services/tables/tables.service";
import type { ListTablesResponse } from "./services/tables/tables.types";

@Injectable()
export class DatabricksAdapter implements DatabricksPort {
  constructor(
    private readonly jobsService: DatabricksJobsService,
    private readonly sqlService: DatabricksSqlService,
    private readonly tablesService: DatabricksTablesService,
  ) {}

  /**
   * Check if the Databricks service is available and responding
   */
  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  /**
   * Trigger a Databricks job with the specified parameters
   */
  async triggerJob(params: DatabricksJobTriggerParams): Promise<Result<DatabricksJobRunResponse>> {
    return this.jobsService.triggerJob(params);
  }

  /**
   * Execute a SQL query in a specific schema
   */
  async executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement);
  }

  /**
   * List tables in the schema for a specific experiment
   */
  async listTables(
    experimentName: string,
    experimentId: string,
  ): Promise<Result<ListTablesResponse>> {
    return this.tablesService.listTables(experimentName, experimentId);
  }
}
