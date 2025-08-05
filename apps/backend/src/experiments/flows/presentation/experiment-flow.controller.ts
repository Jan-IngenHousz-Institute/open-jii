import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { ExperimentDto } from "dist/experiments/core/models/experiment.model";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { handleFailure, failure, success, AppError } from "../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { GetFlowByExperimentUseCase } from "../application/use-cases/get-flow-by-experiment/get-flow-by-experiment";
import { FlowStepRepository } from "../core/repositories/flow-step.repository";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentFlowController {
  private readonly logger = new Logger(ExperimentFlowController.name);

  constructor(
    private readonly getFlowByExperimentUseCase: GetFlowByExperimentUseCase,
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowStepRepository: FlowStepRepository,
  ) {}

  @TsRestHandler(contract.flows.getMobileFlow)
  getMobileFlow(@CurrentUser() user: User) {
    return tsRestHandler(contract.flows.getMobileFlow, async ({ params }) => {
      try {
        const accessResult = await this.experimentRepository.checkAccess(params.id, user.id);
        const result = await accessResult.chain(
          async ({
            experiment,
            hasAccess,
          }: {
            experiment: ExperimentDto | null;
            hasAccess: boolean;
          }) => {
            if (!experiment) {
              this.logger.warn(
                `Attempt to get mobile flow for non-existent experiment with ID ${params.id}`,
              );
              return failure(
                AppError.notFound(
                  `Experiment with ID ${params.id} not found`,
                  "EXPERIMENT_NOT_FOUND",
                ),
              );
            }

            // Check access: either user is a member OR experiment is public
            const hasExperimentAccess = hasAccess || experiment.visibility === "public";
            if (!hasExperimentAccess) {
              this.logger.warn(`User ${user.id} does not have access to experiment ${params.id}`);
              return failure(
                AppError.forbidden("You do not have access to this experiment", "ACCESS_DENIED"),
              );
            }

            // Check if experiment has a flow
            if (!experiment.flowId) {
              return failure(
                AppError.badRequest("Experiment has no flow associated", "NO_FLOW_ASSOCIATED"),
              );
            }

            // Get flow details and steps
            const flowResult = await this.getFlowByExperimentUseCase.execute(params.id);
            if (flowResult.isFailure()) {
              return failure(AppError.internal("Failed to get flow details"));
            }

            // Get flow with connections for mobile format
            const flowWithStepsResult = await this.flowStepRepository.getFlowWithConnections(
              experiment.flowId,
            );
            if (flowWithStepsResult.isFailure()) {
              return failure(AppError.internal("Failed to get flow steps"));
            }

            const flow = flowResult.value;
            const flowWithSteps = flowWithStepsResult.value;

            const flowName = flow.name;
            const flowDescription = flow.description ?? undefined;

            // Convert to mobile format (simplified version)
            const steps = flowWithSteps.steps.map((step) => ({
              id: step.id,
              type: step.type,
              title: step.title,
              description: step.description ?? null,
              stepSpecification: step.stepSpecification,
              nextStepIds: [], // Simplified - could be enhanced to use connections
              isStartStep: step.isStartNode || false,
              isEndStep: step.isEndNode || false,
            }));

            const startStep = steps.find((step) => step.isStartStep);

            const response = {
              flowId: experiment.flowId,
              flowName,
              description: flowDescription,
              steps,
              startStepId: startStep?.id,
            };

            this.logger.log(
              `Mobile flow retrieved for experiment ${params.id}: ${steps.length} steps`,
            );

            return success(response);
          },
        );

        if (result.isFailure()) {
          return handleFailure(result, this.logger);
        }

        return {
          status: StatusCodes.OK,
          body: result.value,
        };
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
