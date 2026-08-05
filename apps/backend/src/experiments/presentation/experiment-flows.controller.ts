import { Controller, Headers, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentFlowsContract } from "@repo/api/domains/experiment/flows/experiment-flows.contract";
import { WORKBOOK_CAPABILITIES_HEADER } from "@repo/api/domains/workbook/workbook-capabilities";

import { CanAccess } from "../../authorization/can-access.decorator";
import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { requireFlowGraphCapability } from "../../common/utils/workbook-capabilities";
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
  getFlow(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(experimentFlowsContract.getFlow).handler(async ({ input }) => {
      const result = await this.getFlowUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        requireFlowGraphCapability(result.value.graph, capabilityHeader);
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentFlowsContract.createFlow)
  createFlow(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(experimentFlowsContract.createFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      requireFlowGraphCapability(body, capabilityHeader);
      const result = await this.createFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        requireFlowGraphCapability(result.value.graph, capabilityHeader);
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentFlowsContract.updateFlow)
  updateFlow(
    @Session() session: UserSession,
    @Headers(WORKBOOK_CAPABILITIES_HEADER) capabilityHeader?: string,
  ) {
    return implement(experimentFlowsContract.updateFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      requireFlowGraphCapability(body, capabilityHeader);
      const result = await this.updateFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        requireFlowGraphCapability(result.value.graph, capabilityHeader);
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
