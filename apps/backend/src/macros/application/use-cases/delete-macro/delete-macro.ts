import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { DatabricksPort } from "../../../core/ports/databricks.port";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class DeleteMacroUseCase {
  private readonly logger = new Logger(DeleteMacroUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(id: string): Promise<Result<void>> {
    this.logger.log(`Deleting macro with id: ${id}`);

    try {
      // First, check if the macro exists
      const macroResult = await this.macroRepository.findById(id);

      if (macroResult.isFailure()) {
        return macroResult;
      }

      if (!macroResult.value) {
        this.logger.warn(`Macro with id ${id} not found for deletion`);
        return failure(AppError.notFound("Macro not found"));
      }

      // Delete from Databricks first
      const databricksResult = await this.databricksPort.deleteMacroCode(id);

      if (!databricksResult.success) {
        this.logger.warn(
          `Failed to delete macro code from Databricks for macro ${id}`,
          databricksResult.message,
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
    } catch (error) {
      this.logger.error(`Error deleting macro with id ${id}`, error);
      return failure(AppError.internal("Failed to delete macro"));
    }
  }
}
