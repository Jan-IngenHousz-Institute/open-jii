import { Injectable } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import type { ProtocolVersionSummaryDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class ListProtocolVersionsUseCase {
  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(protocolId: string): Promise<Result<ProtocolVersionSummaryDto[]>> {
    return this.protocolRepository.listVersions(protocolId);
  }
}
