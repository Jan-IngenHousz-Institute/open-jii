import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DatabricksService } from "./databricks.service";
import { DatabricksAuthService } from "./services/auth/auth.service";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
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
    DatabricksService,
  ],
  exports: [DatabricksService, DatabricksConfigService],
})
export class DatabricksModule {}
