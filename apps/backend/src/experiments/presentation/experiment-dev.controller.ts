import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { handleFailure } from "../../common/utils/fp-utils";
import { SeedDeletionBlockersUseCase } from "../application/use-cases/dev/seed-deletion-blockers";

/**
 * Non-production endpoints for populating/tearing down account-deletion test data. Every handler
 * refuses to run when NODE_ENV is "production" (matching the repo's prod convention), so these
 * never expose seeding in deployed environments.
 */
@Controller()
export class ExperimentDevController {
  private readonly logger = new Logger(ExperimentDevController.name);

  constructor(private readonly seedDeletionBlockersUseCase: SeedDeletionBlockersUseCase) {}

  private get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }

  @TsRestHandler(contract.experiments.seedDeletionBlockers)
  seedDeletionBlockers(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.seedDeletionBlockers, async () => {
      if (this.isProduction) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Seeding is not available in production" },
        };
      }

      const result = await this.seedDeletionBlockersUseCase.seed(session.user.id);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: result.value };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.clearDeletionBlockers)
  clearDeletionBlockers(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.clearDeletionBlockers, async () => {
      if (this.isProduction) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Seeding is not available in production" },
        };
      }

      const result = await this.seedDeletionBlockersUseCase.clear(session.user.id);
      if (result.isSuccess()) {
        return { status: StatusCodes.OK, body: result.value };
      }

      return handleFailure(result, this.logger);
    });
  }
}
