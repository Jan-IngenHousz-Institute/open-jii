import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { handleFailure } from "../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { GetFlowUseCase } from "../application/use-cases/get-flow/get-flow";
import { FlowStepRepository } from "../core/repositories/flow-step.repository";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentFlowController {
  private readonly logger = new Logger(ExperimentFlowController.name);

  constructor(
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowStepRepository: FlowStepRepository,
  ) {}

  @TsRestHandler(contract.flows.getNextStep)
  getNextStep(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.getNextStep, async ({ params, query }) => {
      try {
        const { cursor = 0 } = query;

        // Get the experiment and verify user has access
        const accessResult = await this.experimentRepository.checkAccess(params.id, user.id);
        if (accessResult.isFailure()) {
          return handleFailure(accessResult, this.logger);
        }
        const { experiment } = accessResult.value;
        if (!experiment) {
          return {
            status: StatusCodes.NOT_FOUND,
            body: {
              message: `Experiment with ID ${params.id} not found`,
              code: "EXPERIMENT_NOT_FOUND",
            },
          };
        }

        // Check if experiment has a flow
        if (!experiment.flowId) {
          return {
            status: StatusCodes.BAD_REQUEST,
            body: {
              message: "Experiment has no flow associated",
              code: "NO_FLOW_ASSOCIATED",
            },
          };
        }

        // Get the flow and mobile flow format concurrently
        const [flowResult, mobileFlowResult] = await Promise.all([
          this.getFlowUseCase.execute(experiment.flowId),
          this.flowStepRepository.getMobileFlowExecution(experiment.flowId),
        ]);

        if (flowResult.isFailure()) {
          return handleFailure(flowResult, this.logger);
        }

        if (mobileFlowResult.isFailure()) {
          return handleFailure(mobileFlowResult, this.logger);
        }

        const flow = flowResult.value;
        const mobileFlow = mobileFlowResult.value;

        // Find current step by cursor position (treating mobile steps as sequential)
        const currentStep = mobileFlow.steps[cursor];
        const isComplete = cursor >= mobileFlow.steps.length;

        // Return step in mobile format (no React Flow properties)
        const transformedStep:
          | {
              id: string;
              type: "INSTRUCTION" | "QUESTION" | "MEASUREMENT" | "ANALYSIS";
              title?: string;
              description?: string;
              media?: string[];
              stepSpecification?: Record<string, unknown>;
              nextStepIds: string[];
              isStartStep: boolean;
              isEndStep: boolean;
            }
          | undefined = currentStep;

        const response = {
          step: transformedStep,
          cursor,
          isComplete,
          progress: {
            current: cursor,
            total: mobileFlow.steps.length,
            percentage:
              mobileFlow.steps.length > 0
                ? Math.round((cursor / mobileFlow.steps.length) * 100)
                : 100,
          },
        };

        this.logger.log(
          `Next step for experiment ${params.id}: ${currentStep?.type ?? "COMPLETE"} (${cursor}/${mobileFlow.steps.length})`,
        );

        return {
          status: StatusCodes.OK,
          body: response,
        };
      } catch (error) {
        this.logger.error(`Error getting next step: ${error}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: {
            message: "Internal server error",
            code: "INTERNAL_ERROR",
          },
        };
      }
    });
  }

  @TsRestHandler(contract.flows.submitStepResult)
  submitStepResult(@CurrentUser() _user: SessionUser) {
    return tsRestHandler(contract.flows.submitStepResult, async ({ params, body }) => {
      // For now, just acknowledge the submission and provide the next cursor
      // In a full implementation, you would:
      // 1. Validate the step result
      // 2. Store the result (measurement data, questionnaire answers, etc.)
      // 3. Trigger analysis macros if needed
      // 4. Calculate the next step

      this.logger.log(`Step result submitted for experiment ${params.id}, step ${body.stepId}`);

      // Simple cursor increment for demonstration
      const nextCursor = (body.result as { type?: string }).type === "INSTRUCTION" ? 1 : 1;

      return Promise.resolve({
        status: StatusCodes.OK,
        body: {
          success: true,
          nextCursor,
          message: "Step result processed successfully",
        },
      });
    });
  }

  @TsRestHandler(contract.flows.getMobileFlow)
  getMobileFlow(@CurrentUser() _user: SessionUser) {
    return tsRestHandler(contract.flows.getMobileFlow, async ({ params }) => {
      try {
        const experimentResult = await this.experimentRepository.findOne(params.id);
        if (experimentResult.isFailure()) {
          return handleFailure(experimentResult, this.logger);
        }
        const experiment = experimentResult.value;
        if (!experiment) {
          return {
            status: StatusCodes.NOT_FOUND,
            body: {
              message: `Experiment with ID ${params.id} not found`,
              code: "EXPERIMENT_NOT_FOUND",
            },
          };
        }

        // Check if experiment has a flow
        if (!experiment.flowId) {
          return {
            status: StatusCodes.BAD_REQUEST,
            body: {
              message: "Experiment has no flow associated",
              code: "NO_FLOW_ASSOCIATED",
            },
          };
        }

        // Get the mobile flow execution format and flow details concurrently
        const [mobileFlowResult, flowResult] = await Promise.all([
          this.flowStepRepository.getMobileFlowExecution(experiment.flowId),
          this.getFlowUseCase.execute(experiment.flowId),
        ]);

        if (mobileFlowResult.isFailure()) {
          return handleFailure(mobileFlowResult, this.logger);
        }

        if (flowResult.isFailure()) {
          return handleFailure(flowResult, this.logger);
        }

        const mobileFlow = mobileFlowResult.value;
        const flow = flowResult.value;

        const flowName = flow?.name ?? "Unknown Flow";
        const flowDescription = flow?.description ?? undefined;

        const response: {
          flowId: string;
          flowName: string;
          description?: string;
          steps: {
            id: string;
            type: "INSTRUCTION" | "QUESTION" | "MEASUREMENT" | "ANALYSIS";
            title?: string;
            description?: string;
            media?: string[];
            stepSpecification?: Record<string, unknown>;
            nextStepIds: string[];
            isStartStep: boolean;
            isEndStep: boolean;
          }[];
          startStepId?: string;
        } = {
          flowId: mobileFlow.flowId,
          flowName,
          description: flowDescription ?? undefined,
          steps: mobileFlow.steps,
          startStepId: mobileFlow.startStepId,
        };

        this.logger.log(
          `Mobile flow retrieved for experiment ${params.id}: ${mobileFlow.steps.length} steps`,
        );

        return {
          status: StatusCodes.OK,
          body: response,
        };
      } catch (error) {
        this.logger.error(`Error getting mobile flow: ${error}`);
        return {
          status: StatusCodes.INTERNAL_SERVER_ERROR,
          body: {
            message: "Internal server error",
            code: "INTERNAL_ERROR",
          },
        };
      }
    });
  }
}
