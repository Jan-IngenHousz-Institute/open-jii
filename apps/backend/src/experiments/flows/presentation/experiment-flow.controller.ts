import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { handleFailure, failure, success, AppError } from "../../../common/utils/fp-utils";
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

  @TsRestHandler(contract.flows.getMobileFlow)
  getMobileFlow(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.getMobileFlow, async ({ params }) => {
      try {
        const accessResult = await this.experimentRepository.checkAccess(params.id, user.id);
        const result = await accessResult.chain(
          async ({ experiment, hasAccess }: { experiment: any; hasAccess: boolean }) => {
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

            // Get the mobile flow execution format first
            const mobileFlowResult = await this.flowStepRepository.getMobileFlowExecution(
              experiment.flowId,
            );
            if (mobileFlowResult.isFailure()) {
              return failure(AppError.internal("Failed to get mobile flow execution"));
            }

            // Then get flow details
            const flowResult = await this.getFlowUseCase.execute(experiment.flowId);
            if (flowResult.isFailure()) {
              return failure(AppError.internal("Failed to get flow details"));
            }

            const mobileFlow = mobileFlowResult.value;
            const flow = flowResult.value;

            const flowName = flow.name;
            const flowDescription = flow.description ?? undefined;

            const response = {
              flowId: mobileFlow.flowId,
              flowName,
              description: flowDescription,
              steps: mobileFlow.steps,
              startStepId: mobileFlow.startStepId,
            };

            this.logger.log(
              `Mobile flow retrieved for experiment ${params.id}: ${mobileFlow.steps.length} steps`,
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
