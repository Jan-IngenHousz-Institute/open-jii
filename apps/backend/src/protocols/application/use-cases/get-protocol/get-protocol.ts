import { Injectable, Logger } from "@nestjs/common";

import { PROTOCOL_NOT_FOUND } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class GetProtocolUseCase {
  private readonly logger = new Logger(GetProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Getting protocol",
      operation: "getProtocol",
      context: GetProtocolUseCase.name,
      protocolId: id,
    });

    const result = await this.protocolRepository.findOne(id);

    if (result.isFailure()) {
      return result;
    }

    const protocol = result.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Protocol not found",
        errorCode: PROTOCOL_NOT_FOUND,
        operation: "getProtocol",
        context: GetProtocolUseCase.name,
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    this.logger.log({
      msg: "Protocol retrieved successfully",
      operation: "getProtocol",
      context: GetProtocolUseCase.name,
      protocolId: id,
      status: "success",
    });
    return success(protocol);
  }
}
