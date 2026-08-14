import { Injectable } from "@nestjs/common";

import { DuckDbSqlQueryBuilder, DuckDbVariantQueryBuilder } from "./duckdb-query-builder.base";
import { QueryBuilderService } from "./query-builder.service";

/**
 * DuckDB dialect of the query builder. All composition (filter routing,
 * aggregation wrapping, pagination) lives in the base service; only the
 * builder factories differ.
 */
@Injectable()
export class DuckDbQueryBuilderService extends QueryBuilderService {
  query(): DuckDbSqlQueryBuilder {
    return new DuckDbSqlQueryBuilder();
  }

  variantQuery(): DuckDbVariantQueryBuilder {
    return new DuckDbVariantQueryBuilder();
  }
}
