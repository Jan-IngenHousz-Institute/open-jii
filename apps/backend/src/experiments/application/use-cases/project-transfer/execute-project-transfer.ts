import { Injectable, Logger, Inject } from "@nestjs/common";

import type {
  FlowGraph,
  ProjectTransferWebhookPayload,
  ProjectTransferWebhookResponse,
} from "@repo/api";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateMacroUseCase } from "../../../../macros/application/use-cases/create-macro/create-macro";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { CreateProtocolUseCase } from "../../../../protocols/application/use-cases/create-protocol/create-protocol";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { UserRepository } from "../../../../users/core/repositories/user.repository";
import type { CreateLocationDto } from "../../../core/models/experiment-locations.model";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import type { EmailPort } from "../../../core/ports/email.port";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { CreateFlowUseCase } from "../flows/create-flow";

@Injectable()
export class ExecuteProjectTransferUseCase {
  private readonly logger = new Logger(ExecuteProjectTransferUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
    private readonly locationRepository: LocationRepository,
    private readonly createFlowUseCase: CreateFlowUseCase,
    private readonly createProtocolUseCase: CreateProtocolUseCase,
    private readonly createMacroUseCase: CreateMacroUseCase,
    private readonly macroRepository: MacroRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly userRepository: UserRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  async execute(
    data: ProjectTransferWebhookPayload,
  ): Promise<Result<ProjectTransferWebhookResponse>> {
    this.logger.log({
      msg: "Executing project transfer",
      operation: "executeProjectTransfer",
      experimentName: data.experiment.name,
      protocolName: data.protocol?.name,
      macroName: data.macro?.name,
    });

    // 1. Create or reuse Protocol (if provided)
    let protocolId: string | null = null;
    if (data.protocol) {
      // Check if a protocol with the same name already exists
      const existingProtocol = await this.protocolRepository.findByName(data.protocol.name);

      if (existingProtocol.isSuccess() && existingProtocol.value) {
        protocolId = existingProtocol.value.id;
        this.logger.log({
          msg: "Reusing existing protocol with same name",
          operation: "executeProjectTransfer",
          protocolId,
          protocolName: data.protocol.name,
        });
      } else {
        const protocolResult = await this.createProtocolUseCase.execute(
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

        protocolId = protocolResult.value.id;
      }
    }

    // 2. Create or reuse Macro (if provided)
    let macroId: string | null = null;
    let macroFilename: string | null = null;
    if (data.macro) {
      // Check if a macro with the same name already exists
      const existingMacro = await this.macroRepository.findByName(data.macro.name);

      if (existingMacro.isSuccess() && existingMacro.value) {
        macroId = existingMacro.value.id;
        macroFilename = existingMacro.value.filename;
        this.logger.log({
          msg: "Reusing existing macro with same name",
          operation: "executeProjectTransfer",
          macroId,
          macroFilename,
          macroName: data.macro.name,
        });
      } else {
        const macroResult = await this.createMacroUseCase.execute(
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

        macroId = macroResult.value.id;
        macroFilename = macroResult.value.filename;
      }
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

    // 5. Associate protocol with experiment (if protocol was created)
    if (protocolId) {
      const addProtocolsResult = await this.experimentProtocolRepository.addProtocols(
        experiment.id,
        [{ protocolId, order: 0 }],
      );

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

    // 7. Create flow (non-fatal, requires both protocol and macro)
    let flowId: string | null = null;
    if (protocolId && macroId) {
      const questionNodes: FlowGraph["nodes"] = (data.questions ?? []).map((q, i) => ({
        id: `q_${i}`,
        type: "question" as const,
        name: q.text.substring(0, 64),
        content: {
          kind: q.kind,
          text: q.text,
          required: q.required,
          ...(q.kind === "multi_choice" && { options: q.options ?? [] }),
        } as FlowGraph["nodes"][number]["content"],
        isStart: i === 0,
      }));

      const offset = questionNodes.length;
      const allNodes: FlowGraph["nodes"] = [
        ...questionNodes,
        {
          id: `m_${offset}`,
          type: "measurement",
          name: "Measurement",
          content: { protocolId },
          isStart: offset === 0,
        },
        {
          id: `a_${offset + 1}`,
          type: "analysis",
          name: "Analysis",
          content: { macroId },
          isStart: false,
        },
      ];

      const nodeIds = allNodes.map((n) => n.id);
      const edges: FlowGraph["edges"] = nodeIds.slice(0, -1).map((source, i) => ({
        id: `e_${i}`,
        source,
        target: nodeIds[i + 1],
      }));

      const flowResult = await this.createFlowUseCase.execute(
        experiment.id,
        data.experiment.createdBy,
        { nodes: allNodes, edges } as FlowGraph,
      );

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
    }

    this.logger.log({
      msg: "Project transfer completed",
      operation: "executeProjectTransfer",
      experimentId: experiment.id,
      protocolId,
      macroId,
      flowId,
    });

    // 8. Send project transfer complete email (non-fatal)
    const userResult = await this.userRepository.findOne(data.experiment.createdBy);

    if (userResult.isSuccess() && userResult.value?.email) {
      const emailResult = await this.emailPort.sendProjectTransferComplete(
        userResult.value.email,
        experiment.id,
        experiment.name,
      );

      if (emailResult.isFailure()) {
        this.logger.warn({
          msg: "Failed to send project transfer complete email (non-fatal)",
          operation: "executeProjectTransfer",
          experimentId: experiment.id,
          error: emailResult.error.message,
        });
      }
    } else {
      this.logger.warn({
        msg: "Could not retrieve user email for project transfer notification",
        operation: "executeProjectTransfer",
        userId: data.experiment.createdBy,
      });
    }

    return success({
      success: true,
      experimentId: experiment.id,
      protocolId,
      macroId,
      macroFilename,
      flowId,
    });
  }
}
