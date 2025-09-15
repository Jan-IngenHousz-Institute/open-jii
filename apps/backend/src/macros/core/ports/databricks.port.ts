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
   * @param macro - The uploaded macro
   */
  abstract uploadMacroCode(
    params: Pick<MacroDto, "name" | "code">,
  ): Promise<Result<ImportWorkspaceObjectResponse>>;

  /**
   * Delete macro from Databricks
   * @param macroId - The ID of the macro to delete
   */
  abstract deleteMacroCode(macroId: string): Promise<Result<DeleteWorkspaceObjectResponse>>;
}
