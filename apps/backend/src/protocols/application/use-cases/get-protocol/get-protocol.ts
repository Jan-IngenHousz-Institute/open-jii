import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class GetProtocolUseCase {
  private readonly logger = new Logger(GetProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string, version?: number): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Getting protocol",
      operation: "getProtocol",
      protocolId: id,
      version,
    });

    const result = await this.protocolRepository.findOne(id);

    if (result.isFailure()) {
      return result;
    }

    const protocol = result.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Protocol not found",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "getProtocol",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Serve a pinned version's code when requested (head already holds the latest).
    if (version != null && version !== protocol.latestVersion) {
      const versionResult = await this.protocolRepository.findVersion(id, version);
      if (versionResult.isFailure()) {
        return versionResult;
      }
      if (!versionResult.value) {
        return failure(AppError.notFound(`Protocol version ${version} not found`));
      }
      return success({
        ...protocol,
        code: versionResult.value.code,
        family: versionResult.value.family,
      });
    }

    return success(protocol);
  }
}
