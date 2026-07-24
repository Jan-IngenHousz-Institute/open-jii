import { Injectable, Logger } from "@nestjs/common";

import { zExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import { flowGraphHasDynamicCommandRef } from "@repo/api/transforms/dynamic-command-refs";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { FlowDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

export interface GetFlowOptions {
  /** Whether the requesting client advertised the dynamic-command-ref capability. */
  clientSupportsDynamicRef?: boolean;
}

@Injectable()
export class GetFlowUseCase {
  private readonly logger = new Logger(GetFlowUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    options: GetFlowOptions = {},
  ): Promise<Result<FlowDto>> {
    this.logger.log({
      msg: "Getting flow for experiment",
      operation: "getFlow",
      experimentId,
      userId,
    });

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }
    if (!experimentResult.value) {
      return failure(AppError.notFound("Experiment not found"));
    }

    const flow = await this.flowRepository.getByExperimentId(experimentId);
    return flow.chain((f: FlowDto | null) => {
      if (!f) return failure(AppError.notFound("Flow not found"));

      // Refuse a ref graph to a client lacking the capability. Runs FIRST
      // on the raw graph so an unsupported client never receives a ref
      // graph, even one that would also fail the strict read below.
      if (!options.clientSupportsDynamicRef && flowGraphHasDynamicCommandRef(f.graph)) {
        this.logger.warn({
          msg: "Refused dynamic flow: client lacks dynamic-command-ref capability",
          errorCode: ErrorCodes.DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED,
          operation: "getFlow",
          experimentId,
        });
        return failure(
          AppError.upgradeRequired(
            "This experiment flow requires a newer client to open",
            ErrorCodes.DYNAMIC_COMMAND_CLIENT_UPGRADE_REQUIRED,
          ),
        );
      }

      // Controlled strict-read boundary: a historical row that no longer
      // satisfies the strict schema returns a stable sanitized error (no
      // raw graph/detail) instead of an oRPC output-schema/parse failure.
      const parsed = zExperimentFlowGraph.safeParse(f.graph);
      if (!parsed.success) {
        this.logger.warn({
          msg: "Refused flow read: stored graph is incompatible with the current schema",
          errorCode: ErrorCodes.FLOW_READ_INCOMPATIBLE,
          operation: "getFlow",
          experimentId,
        });
        return failure(
          AppError.internal(
            "This experiment flow is stored in an incompatible format",
            ErrorCodes.FLOW_READ_INCOMPATIBLE,
          ),
        );
      }

      // Return the strict, parsed graph (canonical shape), not the raw row.
      return success({ ...f, graph: parsed.data });
    });
  }
}
