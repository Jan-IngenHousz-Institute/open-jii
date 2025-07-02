import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class GetProtocolUseCase {
  private readonly logger = new Logger(GetProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string): Promise<Result<ProtocolDto>> {
    this.logger.log(`Getting protocol with ID "${id}"`);

    const result = await this.protocolRepository.findOne(id);

    if (result.isFailure()) {
      return result;
    }

    const protocol = result.value;
    if (!protocol) {
      this.logger.warn(`Protocol with ID ${id} not found`);
      return failure(AppError.notFound(`Protocol not found`));
    }

    this.logger.log(`Successfully retrieved protocol with ID ${id}`);
    return success(protocol);
  }
}
