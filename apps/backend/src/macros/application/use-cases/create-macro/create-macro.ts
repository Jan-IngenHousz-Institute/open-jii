import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DatabricksPort, MacroCodeFile } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

export interface CreateMacroRequest extends CreateMacroDto {
  codeFile: string; // Base64 encoded content
}

@Injectable()
export class CreateMacroUseCase {
  private readonly logger = new Logger(CreateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(data: CreateMacroRequest, userId: string): Promise<Result<MacroDto>> {
    this.logger.log(`Creating macro "${data.name}" for user ${userId}`);

    try {
      // First, create the macro in the database
      const macroResult = await this.macroRepository.create(
        {
          name: data.name,
          description: data.description,
          language: data.language,
          codeFile: data.codeFile, // Store the code file in the database
        },
        userId,
      );

      if (macroResult.isFailure()) {
        return macroResult;
      }

      if (macroResult.value.length === 0) {
        this.logger.error(`Failed to create macro "${data.name}" for user ${userId}`);
        return failure(AppError.internal("Failed to create macro"));
      }

      const macro = macroResult.value[0];

      // Process the code file through Databricks
      const codeFile: MacroCodeFile = {
        content: data.codeFile,
        language: data.language,
        macroId: macro.id,
      };

      const databricksResult = await this.databricksPort.processMacroCode(codeFile);

      if (!databricksResult.success) {
        this.logger.error(
          `Failed to process macro code through Databricks for macro ${macro.id}`,
          databricksResult.message,
        );

        // Clean up the macro from database since Databricks processing failed
        await this.macroRepository.delete(macro.id);

        return failure(
          AppError.internal(
            databricksResult.message ?? "Failed to process macro code through Databricks",
          ),
        );
      }

      this.logger.log(`Successfully created macro "${macro.name}" (ID: ${macro.id})`);
      return success(macro);
    } catch (error) {
      this.logger.error(`Error creating macro "${data.name}"`, error);
      return failure(AppError.internal("Failed to create macro"));
    }
  }
}
