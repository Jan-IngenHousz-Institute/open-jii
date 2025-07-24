import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import type { ExperimentDto } from "../../core/models/experiment.model";
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

  @TsRestHandler(contract.flows.submitStepResult)
  submitStepResult(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.submitStepResult, async ({ params, body }) => {
      const accessResult = await this.experimentRepository.checkAccess(params.id, user.id);

      return accessResult.chain(
        async ({
          hasAccess,
          experiment,
        }: {
          hasAccess: boolean;
          experiment: ExperimentDto | null;
        }) => {
          if (!experiment) {
            this.logger.warn(`Experiment with ID ${params.id} not found`);
            return {
              status: StatusCodes.NOT_FOUND,
              body: {
                message: `Experiment with ID ${params.id} not found`,
                code: "EXPERIMENT_NOT_FOUND",
              },
            };
          }

          if (!hasAccess && experiment.visibility !== "public") {
            this.logger.warn(
              `User ${user.id} attempted to submit step result for experiment ${params.id} without proper permissions`,
            );
            return {
              status: StatusCodes.FORBIDDEN,
              body: {
                message: "You do not have access to this experiment",
                code: "ACCESS_DENIED",
              },
            };
          }

          // For now, just acknowledge the submission and provide the next cursor
          // In a full implementation, you would:
          // 1. Validate the step result
          // 2. Store the result (measurement data, questionnaire answers, etc.)
          // 3. Trigger analysis macros if needed
          // 4. Calculate the next step

          this.logger.log(`Step result submitted for experiment ${params.id}, step ${body.stepId}`);

          // Simple cursor increment for demonstration
          const nextCursor = (body.result as { type?: string }).type === "INSTRUCTION" ? 1 : 1;

          return {
            status: StatusCodes.OK,
            body: {
              success: true,
              nextCursor,
              message: "Step result processed successfully",
            },
          };
        },
      );
    });
  }

  @TsRestHandler(contract.flows.getMobileFlow)
  getMobileFlow(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.flows.getMobileFlow, async ({ params }) => {
      const accessResult = await this.experimentRepository.checkAccess(params.id, user.id);

      return accessResult.chain(
        async ({
          hasAccess,
          experiment,
        }: {
          hasAccess: boolean;
          experiment: ExperimentDto | null;
        }) => {
          if (!experiment) {
            this.logger.warn(`Experiment with ID ${params.id} not found`);
            return {
              status: StatusCodes.NOT_FOUND,
              body: {
                message: `Experiment with ID ${params.id} not found`,
                code: "EXPERIMENT_NOT_FOUND",
              },
            };
          }

          if (!hasAccess && experiment.visibility !== "public") {
            this.logger.warn(
              `User ${user.id} attempted to access mobile flow for experiment ${params.id} without proper permissions`,
            );
            return {
              status: StatusCodes.FORBIDDEN,
              body: {
                message: "You do not have access to this experiment",
                code: "ACCESS_DENIED",
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

          // Get the mobile flow execution format first
          const mobileFlowResult = await this.flowStepRepository.getMobileFlowExecution(
            experiment.flowId,
          );

          return mobileFlowResult.chain(async (mobileFlow) => {
            // Then get the flow details
            const flowResult = await this.getFlowUseCase.execute(experiment.flowId!);

            return flowResult.chain((flow) => {
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
            });
          });
        },
      );
    });
  }
}
