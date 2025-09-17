import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class GetMacroUseCase {
  private readonly logger = new Logger(GetMacroUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(id: string): Promise<Result<MacroDto>> {
    this.logger.log(`Getting macro with id: ${id}`);

    const result = await this.macroRepository.findById(id);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn(`Macro with id ${id} not found`);
      return failure(AppError.notFound("Macro not found"));
    }

    return success(result.value);
  }
}
