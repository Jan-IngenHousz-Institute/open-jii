import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import { DuckDbAdapter } from "./duckdb.adapter";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";
import { DeltaSharingService } from "./services/sharing/delta-sharing.service";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    DuckDbConfigService,
    DuckDbSessionService,
    DeltaSharingService,
    DuckDbQueryBuilderService,
    SparkTypeMapper,
    DuckDbAdapter,
  ],
  exports: [DuckDbAdapter],
})
export class DuckDbModule {}
