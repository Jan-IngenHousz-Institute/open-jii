import { Injectable, Inject } from "@nestjs/common";

import { Result, success } from "../../../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../../core/ports/databricks.port";
import type { ExperimentDataQueryStrategy } from "../get-experiment-data";

@Injectable()
export class DeviceDataQueryStrategy implements ExperimentDataQueryStrategy {
  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  async buildQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>> {
    const query = this.databricksPort.buildExperimentDataQuery({
      tableName,
      experimentId,
      columns,
      orderBy,
      orderDirection,
      limit,
      offset,
    });

    return Promise.resolve(success(query));
  }
}
