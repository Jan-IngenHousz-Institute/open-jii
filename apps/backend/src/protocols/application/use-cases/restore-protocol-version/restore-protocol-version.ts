import { Injectable, Logger } from "@nestjs/common";

import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class RestoreProtocolVersionUseCase {
  private readonly logger = new Logger(RestoreProtocolVersionUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(protocolId: string, version: number, userId: string): Promise<Result<ProtocolDto>> {
    const protocolResult = await this.protocolRepository.findOne(protocolId);
    if (protocolResult.isFailure()) {
      return protocolResult;
    }
    const protocol = protocolResult.value;
    if (!protocol) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }
    if (protocol.createdBy !== userId) {
      return failure(AppError.forbidden("Only the protocol creator can restore versions"));
    }

    const versionResult = await this.protocolRepository.findVersion(protocolId, version);
    if (versionResult.isFailure()) {
      return versionResult;
    }
    const target = versionResult.value;
    if (!target) {
      return failure(AppError.notFound(`Protocol version ${version} not found`));
    }

    this.logger.log({
      msg: "Restoring protocol version",
      operation: "restoreProtocolVersion",
      protocolId,
      version,
      userId,
    });

    // Forward-mint the historical code as a new version (immutable append; pins stay valid).
    return this.protocolRepository.mintVersion(protocolId, {
      code: target.code,
      family: target.family,
      createdBy: userId,
    });
  }
}
