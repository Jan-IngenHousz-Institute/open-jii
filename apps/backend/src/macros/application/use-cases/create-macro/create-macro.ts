import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateMacroDto, MacroDto } from "../../../core/models/macro.model";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class CreateMacroUseCase {
  private readonly logger = new Logger(CreateMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(data: CreateMacroDto, userId: string): Promise<Result<MacroDto>> {
    this.logger.log(`Creating macro "${data.name}" for user ${userId}`);

    // First, create the macro in the database
    const macroResult = await this.macroRepository.create(
      {
        name: data.name,
        description: data.description,
        language: data.language,
        code: data.code,
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

    const databricksResult = await this.databricksPort.uploadMacroCode({
      name: macro.name,
      code: macro.code,
    });

    if (databricksResult.isFailure()) {
      this.logger.error(
        `Failed to upload macro code through Databricks for macro ${macro.id}`,
        databricksResult.error.message,
      );

      // Clean up the macro from database since Databricks processing failed
      await this.macroRepository.delete(macro.id);

      return failure(AppError.internal(databricksResult.error.message));
    }

    this.logger.log(`Successfully created macro "${macro.name}" (ID: ${macro.id})`);
    return success(macro);
  }
}
