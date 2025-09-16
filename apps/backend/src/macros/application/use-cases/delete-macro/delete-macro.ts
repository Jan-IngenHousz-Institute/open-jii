import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { DATABRICKS_PORT, DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string): Promise<Result<void>> {
    this.logger.log(`Deleting macro with id: ${id}`);

    // First, check if the macro exists
    const macroResult = await this.macroRepository.findById(id);

    if (macroResult.isFailure()) {
      return macroResult;
    }

    if (!macroResult.value) {
      this.logger.warn(`Macro with id ${id} not found for deletion`);
      return failure(AppError.notFound("Macro not found"));
    }

    const macro = macroResult.value;

    // Delete from Databricks first - use filename, not name
    const databricksResult = await this.databricksPort.deleteMacroCode(macro.filename);

    if (databricksResult.isFailure()) {
      this.logger.warn(
        `Failed to delete macro code from Databricks for macro ${id}`,
        databricksResult.error.message,
      );
      // Continue with database deletion even if Databricks fails
      // as we don't want to leave orphaned database records
    }

    // Delete from database
    const deleteResult = await this.macroRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    // The macro was successfully deleted
    this.logger.log(`Successfully deleted macro with id: ${id}`);
    return success(undefined);
  }
}
