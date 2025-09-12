import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UpdateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DatabricksPort, MacroCodeFile } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

export interface UpdateMacroRequest extends UpdateMacroDto {
  codeFile?: string; // Base64 encoded content - optional for updates
}

@Injectable()
export class UpdateMacroUseCase {
  private readonly logger = new Logger(UpdateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string, data: UpdateMacroRequest): Promise<Result<MacroDto>> {
    this.logger.log(`Updating macro with id: ${id}`);

    try {
      // First, update the macro in the database
      const updateResult = await this.macroRepository.update(id, {
        name: data.name,
        description: data.description,
        language: data.language,
        ...(data.codeFile ? { codeFile: data.codeFile } : {}), // Store the code file if provided
      });

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
      if (data.codeFile) {
        const codeFile: MacroCodeFile = {
          content: data.codeFile,
          language: macro.language,
          macroId: macro.id,
        };

        const databricksResult = await this.databricksPort.updateMacroCode(codeFile);

        if (!databricksResult.success) {
          this.logger.error(
            `Failed to update macro code through Databricks for macro ${macro.id}`,
            databricksResult.message,
          );

          return failure(
            AppError.internal(
              databricksResult.message ?? "Failed to update macro code through Databricks",
            ),
          );
        }
      }

      this.logger.log(`Successfully updated macro "${macro.name}" (ID: ${macro.id})`);
      return success(macro);
    } catch (error) {
      this.logger.error(`Error updating macro with id ${id}`, error);
      return failure(AppError.internal("Failed to update macro"));
    }
  }
}
