import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { formatDates } from "../../../common/utils/date-formatter";
import { handleFailure } from "../../../common/utils/fp-utils";
import { CreateFlowWithStepsUseCase } from "../application/use-cases/create-flow-with-steps/create-flow-with-steps";
import { GetFlowByExperimentUseCase } from "../application/use-cases/get-flow-by-experiment/get-flow-by-experiment";
import { ListFlowsUseCase } from "../application/use-cases/list-flows/list-flows";
import { UpdateFlowWithStepsUseCase } from "../application/use-cases/update-flow-with-steps/update-flow-with-steps";

@Controller()
@UseGuards(AuthGuard)
export class FlowController {
  private readonly logger = new Logger(FlowController.name);

  constructor(
    private readonly createFlowWithStepsUseCase: CreateFlowWithStepsUseCase,
    private readonly getFlowByExperimentUseCase: GetFlowByExperimentUseCase,
    private readonly listFlowsUseCase: ListFlowsUseCase,
    private readonly updateFlowWithStepsUseCase: UpdateFlowWithStepsUseCase,
  ) {}

  @TsRestHandler(contract.flows.createFlowWithSteps)
  createFlowWithSteps(@CurrentUser() user: User) {
    return tsRestHandler(contract.flows.createFlowWithSteps, async ({ body }) => {
      const result = await this.createFlowWithStepsUseCase.execute(body as any, user.id);

      if (result.isSuccess()) {
        const flow = result.value;

        this.logger.log(`Flow with steps created: ${flow.id} by user ${user.id}`);
        
        // Format dates and convert to expected API format
        const formattedFlow = this.formatFlowWithGraphForAPI(flow);
        
        return {
          status: StatusCodes.CREATED,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.getMobileFlow)
  getMobileFlow() {
    return tsRestHandler(contract.flows.getMobileFlow, async ({ params }) => {
      const result = await this.getFlowByExperimentUseCase.execute(params.id);

      if (result.isSuccess()) {
        const flowWithGraph = result.value;

        // Transform React Flow format to Mobile Flow format
        const mobileFlow = this.transformToMobileFlow(flowWithGraph);

        // Format dates to strings for the API contract
        const formattedFlow = formatDates(mobileFlow);

        this.logger.log(`Mobile flow for experiment ${params.id} retrieved`);
        return {
          status: StatusCodes.OK,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.listFlows)
  listFlows() {
    return tsRestHandler(contract.flows.listFlows, async () => {
      const result = await this.listFlowsUseCase.execute();

      if (result.isSuccess()) {
        const flows = result.value;

        // Format dates to strings and handle null/undefined differences
        const formattedFlows = flows.map((flow) => {
          const formatted = formatDates(flow) as any;
          return {
            ...formatted,
            description: formatted.description ?? undefined, // Convert null to undefined
            version: formatted.version ?? 1,
            isActive: formatted.isActive ?? true,
          };
        });

        this.logger.log(`Listed ${flows.length} flows`);
        return {
          status: StatusCodes.OK,
          body: formattedFlows,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.updateFlowWithSteps)
  updateFlowWithSteps(@CurrentUser() user: User) {
    return tsRestHandler(contract.flows.updateFlowWithSteps, async ({ params, body }) => {
      const result = await this.updateFlowWithStepsUseCase.execute(params.id, body as any);

      if (result.isSuccess()) {
        const flow = result.value;

        // Format dates and convert to expected API format
        const formattedFlow = this.formatFlowWithGraphForAPI(flow);

        this.logger.log(`Flow with steps ${params.id} updated by user ${user.id}`);
        return {
          status: StatusCodes.OK,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  private transformToMobileFlow(flowWithGraph: any) {
    // Find the start step
    const startStep = flowWithGraph.steps.find((step: any) => step.isStartNode);

    // Transform steps to mobile format
    const mobileSteps = flowWithGraph.steps.map((step: any) => {
      // Find connections from this step to determine next steps
      const outgoingConnections = flowWithGraph.connections.filter(
        (conn: any) => conn.sourceStepId === step.id,
      );

      return {
        id: step.id,
        type: step.type,
        title: step.title,
        description: step.description,
        media: step.media || [],
        stepSpecification: step.stepSpecification,
        nextStepIds: outgoingConnections.map((conn: any) => conn.targetStepId),
        isStartStep: step.isStartNode,
        isEndStep: step.isEndNode,
      };
    });

    return {
      flowId: flowWithGraph.id,
      flowName: flowWithGraph.name,
      description: flowWithGraph.description,
      steps: mobileSteps,
      startStepId: startStep?.id,
    };
  }

  private formatFlowWithGraphForAPI(flow: any) {
    const formatted = formatDates(flow) as any;
    
    return {
      ...formatted,
      description: formatted.description ?? undefined,
      version: formatted.version ?? 1,
      isActive: formatted.isActive ?? true,
      steps: formatted.steps?.map((step: any) => ({
        ...step,
        title: step.title ?? undefined,
        description: step.description ?? undefined,
        media: step.media ? JSON.parse(step.media) : [],
        position: step.position ? JSON.parse(step.position) : { x: 0, y: 0 },
        size: step.size ? JSON.parse(step.size) : undefined,
        stepSpecification: step.stepSpecification ?? {},
      })) ?? [],
      connections: formatted.connections?.map((conn: any) => ({
        ...conn,
        label: conn.label ?? undefined,
        condition: conn.condition ?? undefined,
        type: conn.type ?? "default",
        animated: conn.animated ?? false,
        priority: conn.priority ?? 0,
      })) ?? [],
    };
  }
}
