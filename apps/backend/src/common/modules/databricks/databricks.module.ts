import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DatabricksAdapter } from "./databricks.adapter";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksPipelinesService } from "./services/pipelines/pipelines.service";
import { QueryBuilderService } from "./services/query-builder/query-builder.service";
import { DatabricksSqlService } from "./services/sql/sql.service";
import { DatabricksTablesService } from "./services/tables/tables.service";
import { DatabricksVolumesService } from "./services/volumes/volumes.service";
import { DatabricksWorkspaceService } from "./services/workspace/workspace.service";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    DatabricksConfigService,
    DatabricksAuthService,
    DatabricksJobsService,
    DatabricksPipelinesService,
    DatabricksSqlService,
    DatabricksTablesService,
    QueryBuilderService,
    DatabricksFilesService,
    DatabricksVolumesService,
    DatabricksWorkspaceService,
    DatabricksAdapter,
  ],
  exports: [DatabricksAdapter, DatabricksConfigService],
})
export class DatabricksModule {}
