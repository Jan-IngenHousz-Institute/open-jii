import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DatabricksAdapter } from "./databricks.adapter";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import { DatabricksPipelinesService } from "./services/pipelines/pipelines.service";
import { DatabricksSqlService } from "./services/sql/sql.service";
import { DatabricksTablesService } from "./services/tables/tables.service";

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
    DatabricksSqlService,
    DatabricksTablesService,
    DatabricksFilesService,
    DatabricksPipelinesService,
    DatabricksAdapter,
  ],
  exports: [DatabricksAdapter, DatabricksConfigService],
})
export class DatabricksModule {}
