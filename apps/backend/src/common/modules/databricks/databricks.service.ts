import { Injectable } from "@nestjs/common";

import { Result } from "../../utils/fp-utils";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import { DatabricksJobTriggerParams, DatabricksJobRunResponse } from "./services/jobs/jobs.types";
import { DatabricksSqlService } from "./services/sql/sql.service";
import { SchemaData } from "./services/sql/sql.types";
import { DatabricksTablesService } from "./services/tables/tables.service";
import { ListTablesResponse } from "./services/tables/tables.types";

@Injectable()
export class DatabricksService {
  constructor(
    private readonly authService: DatabricksAuthService,
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
