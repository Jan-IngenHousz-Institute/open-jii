import { Injectable, Logger, Inject } from "@nestjs/common";

import type {
  FlowGraph,
  ProjectTransferWebhookPayload,
  ProjectTransferWebhookResponse,
} from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import {
  DATABRICKS_PORT as MACRO_DATABRICKS_PORT,
  DatabricksPort as MacroDatabricksPort,
} from "../../../../macros/core/ports/databricks.port";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import type { CreateLocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";

@Injectable()
export class ExecuteProjectTransferUseCase {
  private readonly logger = new Logger(ExecuteProjectTransferUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
    private readonly locationRepository: LocationRepository,
    private readonly flowRepository: FlowRepository,
    private readonly macroRepository: MacroRepository,
    private readonly protocolRepository: ProtocolRepository,
    @Inject(MACRO_DATABRICKS_PORT) private readonly macroDatabricksPort: MacroDatabricksPort,
  ) {}

  async execute(
    data: ProjectTransferWebhookPayload,
  ): Promise<Result<ProjectTransferWebhookResponse>> {
    this.logger.log({
      msg: "Executing project transfer",
      operation: "executeProjectTransfer",
      experimentName: data.experiment.name,
      protocolName: data.protocol.name,
      macroName: data.macro.name,
    });

    // 1. Create Protocol
    const protocolResult = await this.protocolRepository.create(
      {
        name: data.protocol.name,
        description: data.protocol.description ?? null,
        code: JSON.stringify(data.protocol.code),
        family: data.protocol.family,
      },
      data.protocol.createdBy,
    );

    if (protocolResult.isFailure()) {
      return protocolResult;
    }

    if (protocolResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to create protocol during project transfer",
        errorCode: ErrorCodes.PROTOCOL_CREATE_FAILED,
        operation: "executeProjectTransfer",
      });
      return failure(AppError.internal("Failed to create protocol"));
    }

    const protocol = protocolResult.value[0];

    // 2. Create Macro
    const macroResult = await this.macroRepository.create(
      {
        name: data.macro.name,
        description: data.macro.description ?? null,
        language: data.macro.language,
        code: data.macro.code,
      },
      data.macro.createdBy,
    );

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (macroResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to create macro during project transfer",
        errorCode: ErrorCodes.MACRO_CREATE_FAILED,
        operation: "executeProjectTransfer",
      });
      return failure(AppError.internal("Failed to create macro"));
    }

    const macro = macroResult.value[0];

    // Upload macro code to Databricks (non-fatal)
    const databricksResult = await this.macroDatabricksPort.uploadMacroCode({
      filename: macro.filename,
      code: macro.code,
      language: macro.language,
    });

    if (databricksResult.isFailure()) {
      this.logger.warn({
        msg: "Failed to upload macro to Databricks (non-fatal, can be retried)",
        operation: "executeProjectTransfer",
        macroId: macro.id,
        error: databricksResult.error.message,
      });
    }

    // 3. Create Experiment
    const experimentResult = await this.experimentRepository.create(
      { name: data.experiment.name, description: data.experiment.description },
      data.experiment.createdBy,
    );

    if (experimentResult.isFailure()) {
      return experimentResult;
    }

    if (experimentResult.value.length === 0) {
      this.logger.error({
        msg: "Failed to create experiment during project transfer",
        errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
        operation: "executeProjectTransfer",
      });
      return failure(AppError.internal("Failed to create experiment"));
    }

    const experiment = experimentResult.value[0];

    // 4. Add experiment creator as admin member
    const addMembersResult = await this.experimentMemberRepository.addMembers(experiment.id, [
      { userId: data.experiment.createdBy, role: "admin" as const },
    ]);

    if (addMembersResult.isFailure()) {
      return addMembersResult;
    }

    // 5. Associate protocol with experiment
    const addProtocolsResult = await this.experimentProtocolRepository.addProtocols(experiment.id, [
      { protocolId: protocol.id, order: 0 },
    ]);

    if (addProtocolsResult.isFailure()) {
      this.logger.error({
        msg: "Failed to associate protocol with experiment",
        errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
        operation: "executeProjectTransfer",
        experimentId: experiment.id,
        error: addProtocolsResult.error,
      });
      return failure(
        AppError.internal(`Failed to associate protocol: ${addProtocolsResult.error.message}`),
      );
    }

    // 6. Add locations if provided
    if (data.experiment.locations && data.experiment.locations.length > 0) {
      const locations: CreateLocationDto[] = data.experiment.locations.map((loc) => ({
        ...loc,
        experimentId: experiment.id,
      }));

      const addLocationsResult = await this.locationRepository.createMany(locations);

      if (addLocationsResult.isFailure()) {
        this.logger.error({
          msg: "Failed to add locations during project transfer",
          errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
          operation: "executeProjectTransfer",
          experimentId: experiment.id,
          error: addLocationsResult.error,
        });
        return failure(
          AppError.internal(`Failed to add locations: ${addLocationsResult.error.message}`),
        );
      }
    }

    // 7. Create flow (non-fatal)
    let flowId: string | null = null;
    try {
      const flowNodes: FlowGraph["nodes"] = [];
      const flowEdges: FlowGraph["edges"] = [];
      let nodeIndex = 0;

      // Question nodes
      const questionNodeIds: string[] = [];
      if (data.questions && data.questions.length > 0) {
        for (const question of data.questions) {
          const nodeId = `q_${nodeIndex}`;

          let content: FlowGraph["nodes"][number]["content"];
          if (question.kind === "multi_choice") {
            content = {
              kind: "multi_choice" as const,
              text: question.text,
              options: question.options ?? [],
              required: question.required,
            };
          } else if (question.kind === "yes_no") {
            content = {
              kind: "yes_no" as const,
              text: question.text,
              required: question.required,
            };
          } else if (question.kind === "number") {
            content = {
              kind: "number" as const,
              text: question.text,
              required: question.required,
            };
          } else {
            content = {
              kind: "open_ended" as const,
              text: question.text,
              required: question.required,
            };
          }

          flowNodes.push({
            id: nodeId,
            type: "question",
            name: question.text.substring(0, 64),
            content,
            isStart: nodeIndex === 0,
          });
          questionNodeIds.push(nodeId);
          nodeIndex++;
        }
      }

      // Measurement node
      const measurementNodeId = `m_${nodeIndex}`;
      flowNodes.push({
        id: measurementNodeId,
        type: "measurement",
        name: "Measurement",
        content: { protocolId: protocol.id },
        isStart: questionNodeIds.length === 0,
      });
      nodeIndex++;

      // Analysis node
      const analysisNodeId = `a_${nodeIndex}`;
      flowNodes.push({
        id: analysisNodeId,
        type: "analysis",
        name: "Analysis",
        content: { macroId: macro.id },
        isStart: false,
      });

      // Edges: questions → measurement → analysis
      let edgeIndex = 0;
      for (let i = 0; i < questionNodeIds.length; i++) {
        const targetId =
          i < questionNodeIds.length - 1 ? questionNodeIds[i + 1] : measurementNodeId;
        flowEdges.push({
          id: `e_${edgeIndex}`,
          source: questionNodeIds[i],
          target: targetId,
        });
        edgeIndex++;
      }
      flowEdges.push({
        id: `e_${edgeIndex}`,
        source: measurementNodeId,
        target: analysisNodeId,
      });

      const flowResult = await this.flowRepository.create(experiment.id, {
        nodes: flowNodes,
        edges: flowEdges,
      } as FlowGraph);

      if (flowResult.isSuccess()) {
        flowId = flowResult.value.id;
      } else {
        this.logger.warn({
          msg: "Failed to create flow during project transfer (non-fatal)",
          operation: "executeProjectTransfer",
          experimentId: experiment.id,
          error: flowResult.error,
        });
      }
    } catch (error) {
      this.logger.warn({
        msg: "Error building flow for project transfer (non-fatal)",
        operation: "executeProjectTransfer",
        experimentId: experiment.id,
        error: String(error),
      });
    }

    this.logger.log({
      msg: "Project transfer completed",
      operation: "executeProjectTransfer",
      experimentId: experiment.id,
      protocolId: protocol.id,
      macroId: macro.id,
      flowId,
    });

    return success({
      success: true,
      experimentId: experiment.id,
      protocolId: protocol.id,
      macroId: macro.id,
      flowId,
    });
  }
}
