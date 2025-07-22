import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto, UpdateProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class UpdateProtocolUseCase {
  private readonly logger = new Logger(UpdateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string, updateProtocolDto: UpdateProtocolDto): Promise<Result<ProtocolDto>> {
    this.logger.log(`Updating protocol with ID "${id}"`);

    // Check if protocol exists
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn(`Attempt to update non-existent protocol with ID ${id}`);
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Prevent update if protocol is assigned to any experiment
    const isAssigned = await this.protocolRepository.isAssignedToAnyExperiment(id);
    if (isAssigned) {
      this.logger.warn(
        `Attempt to update protocol with ID ${id} which is assigned to an experiment`,
      );
      return failure(AppError.forbidden("Cannot update protocol assigned to an experiment"));
    }

    // Protocol exists and is not assigned, now update it
    const updateResult = await this.protocolRepository.update(id, updateProtocolDto);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const protocols = updateResult.value;
    if (protocols.length === 0) {
      this.logger.error(`Failed to update protocol with ID ${id}`);
      return failure(AppError.internal("Failed to update protocol"));
    }

    this.logger.log(`Successfully updated protocol with ID ${id}`);
    return success(protocols[0]);
  }
}
