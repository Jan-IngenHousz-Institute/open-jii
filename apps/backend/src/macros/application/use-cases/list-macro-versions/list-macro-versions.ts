import { Injectable } from "@nestjs/common";

import type { Result } from "../../../../common/utils/fp-utils";
import type { MacroVersionSummaryDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ListMacroVersionsUseCase {
  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(macroId: string): Promise<Result<MacroVersionSummaryDto[]>> {
    return this.macroRepository.listVersions(macroId);
  }
}
