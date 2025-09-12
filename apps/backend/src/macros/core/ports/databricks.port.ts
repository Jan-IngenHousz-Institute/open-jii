import { Injectable } from "@nestjs/common";

export interface MacroCodeFile {
  content: string; // Base64 encoded content
  language: "python" | "r" | "javascript";
  macroId: string;
}

export interface DatabricksResponse {
  success: boolean;
  message?: string;
  databricksJobId?: string;
}

@Injectable()
export abstract class DatabricksPort {
  /**
   * Process macro code file through Databricks
   * @param codeFile - The macro code file to process
   * @returns Promise<DatabricksResponse>
   */
  abstract processMacroCode(codeFile: MacroCodeFile): Promise<DatabricksResponse>;

  /**
   * Update macro code file in Databricks
   * @param codeFile - The updated macro code file
   * @returns Promise<DatabricksResponse>
   */
  abstract updateMacroCode(codeFile: MacroCodeFile): Promise<DatabricksResponse>;

  /**
   * Delete macro from Databricks
   * @param macroId - The ID of the macro to delete
   * @returns Promise<DatabricksResponse>
   */
  abstract deleteMacroCode(macroId: string): Promise<DatabricksResponse>;
}
