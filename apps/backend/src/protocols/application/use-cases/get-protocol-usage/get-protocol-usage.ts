import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

interface ProtocolUsageResult {
  count: number;
  workbooks: { id: string; name: string }[];
}

@Injectable()
export class GetProtocolUsageUseCase {
  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(protocolId: string): Promise<Result<ProtocolUsageResult>> {
    const result = await this.protocolRepository.findReferencingWorkbooks(protocolId);
    if (result.isFailure()) {
      return result;
    }
    return success({ count: result.value.length, workbooks: result.value });
  }
}
