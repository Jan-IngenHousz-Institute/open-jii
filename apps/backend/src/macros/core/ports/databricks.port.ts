import type {
  DeleteWorkspaceObjectResponse,
  ImportWorkspaceObjectResponse,
} from "../../../common/modules/databricks/services/workspace/workspace.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { MacroDto } from "../models/macro.model";

/**
 * Injection token for the Macro Databricks port
 */
export const DATABRICKS_PORT = Symbol("MACRO_DATABRICKS_PORT");

export abstract class DatabricksPort {
  /**
   * Upload macro code file to Databricks
   * Formats the macro name by converting to lowercase and replacing spaces with underscores
   * Adds appropriate file extension based on the language
   * @param macro - The uploaded macro with name, code, and language
   */
  abstract uploadMacroCode(
    params: Pick<MacroDto, "name" | "code" | "language">,
  ): Promise<Result<ImportWorkspaceObjectResponse>>;

  /**
   * Delete macro from Databricks
   * @param macroName - The name of the macro to delete (will be formatted)
   */
  abstract deleteMacroCode(macroName: string): Promise<Result<DeleteWorkspaceObjectResponse>>;
}
