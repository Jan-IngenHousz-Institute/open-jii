import { Injectable, Inject } from "@nestjs/common";

import { and, eq, inArray, macros, commandMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { CommandMacroDto } from "../models/command-macro.model";

@Injectable()
export class CommandMacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listMacros(commandId: string): Promise<Result<CommandMacroDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          commandId: commandMacros.commandId,
          addedAt: commandMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(commandMacros)
        .innerJoin(macros, eq(commandMacros.macroId, macros.id))
        .where(eq(commandMacros.commandId, commandId))
        .orderBy(macros.name);
    });
  }

  async addMacros(commandId: string, macroIds: string[]): Promise<Result<CommandMacroDto[]>> {
    return tryCatch(async () => {
      if (!macroIds.length) return [];
      await this.database
        .insert(commandMacros)
        .values(macroIds.map((macroId) => ({ commandId, macroId })))
        .onConflictDoNothing();
      return this.database
        .select({
          commandId: commandMacros.commandId,
          addedAt: commandMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(commandMacros)
        .innerJoin(macros, eq(commandMacros.macroId, macros.id))
        .where(
          and(eq(commandMacros.commandId, commandId), inArray(commandMacros.macroId, macroIds)),
        )
        .orderBy(macros.name);
    });
  }

  async removeMacro(commandId: string, macroId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(commandMacros)
        .where(and(eq(commandMacros.commandId, commandId), eq(commandMacros.macroId, macroId)));
      return undefined;
    });
  }
}
