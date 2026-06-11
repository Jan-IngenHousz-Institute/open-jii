import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { handleFailure } from "../../common/utils/fp-utils";
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

  @TsRestHandler(contract.experiments.getExperimentTables)
  getExperimentTables(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentTables, async ({ params }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing tables metadata request",
        operation: "getTables",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.getExperimentTablesUseCase.execute(experimentId, session.user.id);

      if (result.isSuccess()) {
        const data = result.value;

        this.logger.log({
          msg: "Successfully retrieved table metadata",
          operation: "getTables",
          experimentId,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: data,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getExperimentData)
  getExperimentData(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentData, async ({ params, query }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing data request",
        operation: "getData",
        experimentId,
        userId: session.user.id,
      });

      // Forward the parsed query verbatim; `filters` and `aggregation` are
      // already decoded from JSON-encoded strings into their structured
      // shapes by the contract's zod transforms.
      const result = await this.getExperimentDataUseCase.execute(
        experimentId,
        session.user.id,
        query,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully retrieved data",
          operation: "getData",
          experimentId,
          status: "success",
        });

        return {
          status: StatusCodes.OK,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getDistinctColumnValues)
  getDistinctColumnValues(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.getDistinctColumnValues,
      async ({ params, query }) => {
        const { id: experimentId } = params;

        this.logger.log({
          msg: "Processing distinct values request",
          operation: "getDistinctColumnValues",
          experimentId,
          userId: session.user.id,
          column: query.column,
        });

        const result = await this.getDistinctColumnValuesUseCase.execute(
          experimentId,
          session.user.id,
          query,
        );

        if (result.isSuccess()) {
          return {
            status: StatusCodes.OK,
            body: result.value,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }
}
