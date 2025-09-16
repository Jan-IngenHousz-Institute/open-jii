import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string, data: UpdateMacroDto): Promise<Result<MacroDto>> {
    this.logger.log(`Updating macro with id: ${id}`);

    // First, update the macro in the database
    const updateResult = await this.macroRepository.update(id, data);

    if (updateResult.isFailure()) {
      return updateResult;
    }

    const macros = updateResult.value;
    if (macros.length === 0) {
      this.logger.error(`Failed to update macro with id ${id}`);
      return failure(AppError.internal("Failed to update macro"));
    }

    const macro = macros[0];

    // If a new code file is provided, process it through Databricks
    if (data.code) {
      const databricksResult = await this.databricksPort.uploadMacroCode({
        filename: macro.filename,
        code: data.code,
        language: macro.language,
      });

      if (databricksResult.isFailure()) {
        this.logger.error(
          `Failed to upload macro code through Databricks for macro ${macro.id}`,
          databricksResult.error.message,
        );

        return failure(AppError.internal(databricksResult.error.message));
      }
    }

    this.logger.log(`Successfully updated macro "${macro.name}" (ID: ${macro.id})`);
    return success(macro);
  }
}
