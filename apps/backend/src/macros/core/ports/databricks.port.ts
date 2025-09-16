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
   * @param params - The macro with filename, code, and language
   */
  abstract uploadMacroCode(
    params: Pick<MacroDto, "filename" | "code" | "language">,
  ): Promise<Result<ImportWorkspaceObjectResponse>>;

  /**
   * Delete macro from Databricks
   * @param filename - The filename of the macro to delete
   */
  abstract deleteMacroCode(filename: string): Promise<Result<DeleteWorkspaceObjectResponse>>;
}
