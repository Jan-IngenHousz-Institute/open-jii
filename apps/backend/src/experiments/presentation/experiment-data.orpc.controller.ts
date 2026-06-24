import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentDataOrpcContract } from "@repo/api/domains/experiment/experiment-data.orpc";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetDistinctColumnValuesUseCase } from "../application/use-cases/experiment-data/get-distinct-column-values";
import { GetExperimentDataUseCase } from "../application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentTablesUseCase } from "../application/use-cases/experiment-data/get-experiment-tables";

@Controller()
export class ExperimentDataOrpcController {
  private readonly logger = new Logger(ExperimentDataOrpcController.name);

  constructor(
    private readonly getExperimentDataUseCase: GetExperimentDataUseCase,
    private readonly getExperimentTablesUseCase: GetExperimentTablesUseCase,
    private readonly getDistinctColumnValuesUseCase: GetDistinctColumnValuesUseCase,
  ) {}

  @Implement(experimentDataOrpcContract.getExperimentTables)
  getExperimentTables(@Session() session: UserSession) {
    return implement(experimentDataOrpcContract.getExperimentTables).handler(async ({ input }) => {
      const result = await this.getExperimentTablesUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDataOrpcContract.getExperimentData)
  getExperimentData(@Session() session: UserSession) {
    return implement(experimentDataOrpcContract.getExperimentData).handler(async ({ input }) => {
      const { id, ...query } = input;
      const result = await this.getExperimentDataUseCase.execute(id, session.user.id, query);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDataOrpcContract.getDistinctColumnValues)
  getDistinctColumnValues(@Session() session: UserSession) {
    return implement(experimentDataOrpcContract.getDistinctColumnValues).handler(async ({ input }) => {
      const { id, ...query } = input;
      const result = await this.getDistinctColumnValuesUseCase.execute(id, session.user.id, query);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
