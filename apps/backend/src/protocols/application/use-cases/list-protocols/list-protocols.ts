import { Injectable } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api";

import { Result } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class ListProtocolsUseCase {
  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(search?: ProtocolFilter): Promise<Result<ProtocolDto[]>> {
    return this.protocolRepository.findAll(search);
  }
}
