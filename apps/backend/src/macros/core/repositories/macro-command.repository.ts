import { Injectable, Inject } from "@nestjs/common";

import { and, eq, inArray, commands, commandMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { MacroCommandDto } from "../models/macro-command.model";

@Injectable()
export class MacroCommandRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listCommands(macroId: string): Promise<Result<MacroCommandDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          macroId: commandMacros.macroId,
          addedAt: commandMacros.addedAt,
          command: {
            id: commands.id,
            name: commands.name,
            family: commands.family,
            createdBy: commands.createdBy,
          },
        })
        .from(commandMacros)
        .innerJoin(commands, eq(commandMacros.commandId, commands.id))
        .where(eq(commandMacros.macroId, macroId))
        .orderBy(commands.name);
    });
  }

  async addCommands(macroId: string, commandIds: string[]): Promise<Result<MacroCommandDto[]>> {
    return tryCatch(async () => {
      if (!commandIds.length) return [];
      await this.database
        .insert(commandMacros)
        .values(commandIds.map((commandId) => ({ macroId, commandId })))
        .onConflictDoNothing();
      return this.database
        .select({
          macroId: commandMacros.macroId,
          addedAt: commandMacros.addedAt,
          command: {
            id: commands.id,
            name: commands.name,
            family: commands.family,
            createdBy: commands.createdBy,
          },
        })
        .from(commandMacros)
        .innerJoin(commands, eq(commandMacros.commandId, commands.id))
        .where(
          and(eq(commandMacros.macroId, macroId), inArray(commandMacros.commandId, commandIds)),
        )
        .orderBy(commands.name);
    });
  }

  async removeCommand(macroId: string, commandId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(commandMacros)
        .where(and(eq(commandMacros.macroId, macroId), eq(commandMacros.commandId, commandId)));
      return undefined;
    });
  }

  /**
   * Check if a command exists by ID.
   * Used to validate command IDs without importing CommandModule (avoids circular dependency).
   */
  async findCommandById(
    commandId: string,
  ): Promise<Result<{ id: string; name: string; family: string; createdBy: string } | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          id: commands.id,
          name: commands.name,
          family: commands.family,
          createdBy: commands.createdBy,
        })
        .from(commands)
        .where(eq(commands.id, commandId))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }
}
