import { Controller, Logger, Req } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import type { Request } from "express";

import { experimentFlowsContract } from "@repo/api/domains/experiment/flows/experiment-flows.contract";
import {
  DYNAMIC_COMMAND_REF_CAPABILITY,
  OPENJII_CAPABILITIES_HEADER,
  hasCapability,
} from "@repo/api/domains/workbook/capabilities";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateFlowUseCase } from "../application/use-cases/flows/create-flow";
import { GetFlowUseCase } from "../application/use-cases/flows/get-flow";
import { UpdateFlowUseCase } from "../application/use-cases/flows/update-flow";

@Controller()
export class ExperimentFlowsController {
  private readonly logger = new Logger(ExperimentFlowsController.name);

  constructor(
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly createFlowUseCase: CreateFlowUseCase,
    private readonly updateFlowUseCase: UpdateFlowUseCase,
  ) {}

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentFlowsContract.getFlow)
  getFlow(@Session() session: UserSession, @Req() request: Request) {
    const clientSupportsDynamicRef = hasCapability(
      request.headers[OPENJII_CAPABILITIES_HEADER],
      DYNAMIC_COMMAND_REF_CAPABILITY,
    );
    return implement(experimentFlowsContract.getFlow).handler(async ({ input }) => {
      const result = await this.getFlowUseCase.execute(input.id, session.user.id, {
        clientSupportsDynamicRef,
      });
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentFlowsContract.createFlow)
  createFlow(@Session() session: UserSession) {
    return implement(experimentFlowsContract.createFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.createFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentFlowsContract.updateFlow)
  updateFlow(@Session() session: UserSession) {
    return implement(experimentFlowsContract.updateFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.updateFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
