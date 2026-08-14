import { Module } from "@nestjs/common";

import { DatabricksModule } from "../databricks/databricks.module";
import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import { DuckDbAdapter } from "./duckdb.adapter";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";

@Module({
  imports: [DatabricksModule],
  providers: [
    DuckDbConfigService,
    DuckDbSessionService,
    DuckDbQueryBuilderService,
    SparkTypeMapper,
    DuckDbAdapter,
  ],
  exports: [DuckDbAdapter],
})
export class DuckDbModule {}
