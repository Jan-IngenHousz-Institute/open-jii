import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentDataContract } from "@repo/api/domains/experiment/data/experiment-data.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetDistinctColumnValuesUseCase } from "../application/use-cases/experiment-data/get-distinct-column-values";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";

@Controller()
export class ExperimentDataController {
  private readonly logger = new Logger(ExperimentDataController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentTablesUseCase: GetExperimentTablesUseCase,
    private readonly getDistinctColumnValuesUseCase: GetDistinctColumnValuesUseCase,
  ) {}

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getExperimentTables)
  getExperimentTables(@Session() session: UserSession) {
    return implement(experimentDataContract.getExperimentTables).handler(async ({ input }) => {
      const result = await this.getExperimentTablesUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getExperimentData)
  getExperimentData(@Session() session: UserSession) {
    return implement(experimentDataContract.getExperimentData).handler(async ({ input }) => {
      const { id, ...query } = input;
      const result = await this.getExperimentDataUseCase.execute(id, session.user.id, query);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentDataContract.getDistinctColumnValues)
  getDistinctColumnValues(@Session() session: UserSession) {
    return implement(experimentDataContract.getDistinctColumnValues).handler(async ({ input }) => {
      const { id, ...query } = input;
      const result = await this.getDistinctColumnValuesUseCase.execute(id, session.user.id, query);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
