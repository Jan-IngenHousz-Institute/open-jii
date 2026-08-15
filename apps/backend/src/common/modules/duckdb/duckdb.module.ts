import { Module } from "@nestjs/common";

import { DuckDbQueryBuilderService } from "../databricks/services/query-builder/duckdb-query-builder.service";
import { DeltaModule } from "../delta/delta.module";
import { DuckDbAdapter } from "./duckdb.adapter";
import { DuckDbConfigService } from "./services/config/duckdb-config.service";
import { SparkTypeMapper } from "./services/schema/spark-type-mapper";
import { DuckDbSessionService } from "./services/session/duckdb-session.service";

/**
 * Embedded DuckDB read engine. Sources its data through {@link DeltaModule},
 * which is the only part that speaks the sharing protocol.
 */
@Module({
  imports: [DeltaModule],
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
