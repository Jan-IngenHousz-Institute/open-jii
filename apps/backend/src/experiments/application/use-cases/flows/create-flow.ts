import { Injectable, Logger } from "@nestjs/common";

import { zExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import {
  flowGraphHasDynamicCommandRef,
  validateDynamicCommandFlowGraph,
} from "@repo/api/transforms/dynamic-command-refs";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../../core/models/experiment.model";
import type { FlowDto, FlowGraphDto } from "../../../core/models/flow.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import {
  dynamicFlowPublishDisabledError,
  dynamicFlowStructuralError,
  isDynamicCommandPublishEnabled,
} from "./dynamic-flow-gate";

@Injectable()
export class CreateFlowUseCase {
  private readonly logger = new Logger(CreateFlowUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly flowRepository: FlowRepository,
  ) {}

  async execute(
    experimentId: string,
    userId: string,
    graph: FlowGraphDto,
  ): Promise<Result<FlowDto>> {
    const experimentResult = await this.experimentRepository.findOne(experimentId);

    return experimentResult.chain(async (experiment: ExperimentDto | null) => {
      if (!experiment) return failure(AppError.notFound("Experiment not found"));

      // Authorization is enforced declaratively by @CanAccess on the route.
      // Archived experiments are read-only: a domain rule describing which
      // operations are legal, not who may perform them.
      if (experiment.status === "archived") {
        return failure(AppError.forbidden("Cannot modify an archived experiment"));
      }

      // Strict-parse the graph ourselves before ANY repository access, so a
      // direct/cast caller cannot smuggle a misplaced ref-like key that Zod
      // would otherwise strip. Only parsed data is persisted.
      const parsed = zExperimentFlowGraph.safeParse(graph);
      if (!parsed.success) {
        return failure(AppError.badRequest("Invalid flow graph", "FLOW_GRAPH_INVALID"));
      }
      const flowGraph = parsed.data;

      // A dynamic-ref graph is gated (gate-off rejects first) and, when
      // allowed, must pass structural validation before any persistence.
      if (flowGraphHasDynamicCommandRef(flowGraph)) {
        if (!isDynamicCommandPublishEnabled()) {
          this.logger.warn({
            msg: "Blocked flow create: dynamic command publication is disabled",
            operation: "createFlow",
            experimentId,
          });
          return failure(dynamicFlowPublishDisabledError());
        }
        const issues = validateDynamicCommandFlowGraph(flowGraph.nodes, flowGraph.edges);
        if (issues.length > 0) {
          this.logger.warn({
            msg: "Blocked flow create: dynamic command references are structurally invalid",
            operation: "createFlow",
            experimentId,
            issueCodes: issues.map((i) => i.code),
          });
          return failure(dynamicFlowStructuralError(issues));
        }
      }

      // Ensure there isn't an existing flow
      const existing = await this.flowRepository.getByExperimentId(experimentId);
      return existing.chain(async (flow) => {
        if (flow) {
          return failure(AppError.badRequest("Flow already exists for this experiment"));
        }
        return this.flowRepository.create(experimentId, flowGraph);
      });
    });
  }
}
