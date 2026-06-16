import { Injectable } from "@nestjs/common";

import { Result, success } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../core/repositories/macro.repository";

interface MacroUsageResult {
  count: number;
  workbooks: { id: string; name: string }[];
}

@Injectable()
export class GetMacroUsageUseCase {
  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(macroId: string): Promise<Result<MacroUsageResult>> {
    const result = await this.macroRepository.findReferencingWorkbooks(macroId);
    if (result.isFailure()) {
      return result;
    }
    return success({ count: result.value.length, workbooks: result.value });
  }
}
