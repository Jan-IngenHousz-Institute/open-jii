import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../../common/utils/date-formatter";
import { handleFailure } from "../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { CreateFlowStepUseCase } from "../application/use-cases/create-flow-step/create-flow-step";
import { CreateFlowUseCase } from "../application/use-cases/create-flow/create-flow";
import { GetFlowUseCase } from "../application/use-cases/get-flow/get-flow";
import { ListFlowsUseCase } from "../application/use-cases/list-flows/list-flows";

@Controller()
@UseGuards(AuthGuard)
export class FlowController {
  private readonly logger = new Logger(FlowController.name);

  constructor(
    private readonly createFlowUseCase: CreateFlowUseCase,
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly listFlowsUseCase: ListFlowsUseCase,
    private readonly createFlowStepUseCase: CreateFlowStepUseCase,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  @TsRestHandler(contract.flows.createFlow)
  createFlow(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.createFlow, async ({ body }) => {
      const result = await this.createFlowUseCase.execute(body, user.id);

      if (result.isSuccess()) {
        const flow = result.value;
        this.logger.log(`Flow created: ${flow.id} by user ${user.id}`);
        return {
          status: StatusCodes.CREATED,
          body: { id: flow.id },
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
        this.logger.log(`Listed ${flows.length} flows`);
        return {
          status: StatusCodes.OK as const,
          body: formatDatesList(
            flows.map((flow) => ({
              ...flow,
              description: flow.description ?? undefined,
            })),
          ),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.getFlow)
  getFlow(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.getFlow, async ({ params }) => {
      const result = await this.getFlowUseCase.execute(params.id);

      if (result.isFailure()) {
        return handleFailure(result, this.logger);
      }

      const flowWithSteps = result.value;
      const { steps: _steps, ...flow } = flowWithSteps;

      // Find experiment that owns this flow and check access
      const experimentResult = await this.experimentRepository.findByFlowId(params.id);

      if (experimentResult.isFailure()) {
        return handleFailure(experimentResult, this.logger);
      }

      const experiment = experimentResult.value;

      if (experiment) {
        const accessResult = await this.experimentRepository.checkAccess(experiment.id, user.id);

        if (accessResult.isFailure()) {
          return handleFailure(accessResult, this.logger);
        }

        const { hasAccess } = accessResult.value;

        if (!hasAccess) {
          return {
            status: StatusCodes.FORBIDDEN,
            body: {
              message: "Access denied to this experiment's flow",
              code: "ACCESS_DENIED",
            },
          };
        }
      }

      this.logger.log(`Retrieved flow: ${flow.id}`);
      return {
        status: StatusCodes.OK as const,
        body: formatDates({
          ...flow,
          description: flow.description ?? undefined,
        }),
      };
    });
  }

  @TsRestHandler(contract.flows.createFlowStep)
  createFlowStep(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.createFlowStep, async ({ params, body }) => {
      // Find experiment that owns this flow and check admin access
      const experimentResult = await this.experimentRepository.findByFlowId(params.id);

      if (experimentResult.isFailure()) {
        return handleFailure(experimentResult, this.logger);
      }

      const experiment = experimentResult.value;

      if (experiment) {
        const accessResult = await this.experimentRepository.checkAccess(experiment.id, user.id);

        if (accessResult.isFailure()) {
          return handleFailure(accessResult, this.logger);
        }

        const { hasAccess, isAdmin } = accessResult.value;

        if (!hasAccess) {
          return {
            status: StatusCodes.FORBIDDEN,
            body: {
              message: "Access denied to this experiment",
              code: "ACCESS_DENIED",
            },
          };
        }

        if (!isAdmin) {
          return {
            status: StatusCodes.FORBIDDEN,
            body: {
              message: "Only experiment admins can create flow steps",
              code: "ADMIN_REQUIRED",
            },
          };
        }
      }

      const result = await this.createFlowStepUseCase.execute(params.id, body);

      if (result.isSuccess()) {
        const step = result.value;
        this.logger.log(`Flow step created: ${step.id} by user ${user.id}`);
        return {
          status: StatusCodes.CREATED as const,
          body: step,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.listFlowSteps)
  getFlowSteps(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.listFlowSteps, async ({ params }) => {
      const result = await this.getFlowUseCase.execute(params.id);

      if (result.isFailure()) {
        return handleFailure(result, this.logger);
      }

      const flowData = result.value;

      // Find experiment that owns this flow and check access
      const experimentResult = await this.experimentRepository.findByFlowId(params.id);

      if (experimentResult.isFailure()) {
        return handleFailure(experimentResult, this.logger);
      }

      const experiment = experimentResult.value;

      if (experiment) {
        const accessResult = await this.experimentRepository.checkAccess(experiment.id, user.id);

        if (accessResult.isFailure()) {
          return handleFailure(accessResult, this.logger);
        }

        const { hasAccess } = accessResult.value;

        if (!hasAccess) {
          return {
            status: StatusCodes.FORBIDDEN,
            body: {
              message: "Access denied to this experiment's flow steps",
              code: "ACCESS_DENIED",
            },
          };
        }
      }

      // Convert steps to React Flow format
      const reactFlowSteps = flowData.steps.map((step) => ({
        id: step.id,
        type: step.type.toLowerCase(),
        position: step.position ?? { x: 0, y: 0 },
        data: {
          type: step.type,
          title: step.title,
          description: step.description,
          media: step.media,
          stepSpecification: step.stepSpecification,
          isStartNode: step.isStartNode,
          isEndNode: step.isEndNode,
        },
      }));

      this.logger.log(`Retrieved ${reactFlowSteps.length} steps for flow: ${params.id}`);
      return {
        status: StatusCodes.OK as const,
        body: reactFlowSteps,
      };
    });
  }
}
