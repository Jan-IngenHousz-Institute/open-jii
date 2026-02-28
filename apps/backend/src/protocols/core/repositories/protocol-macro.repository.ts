import { Injectable, Inject } from "@nestjs/common";

import { and, eq, inArray, macros, protocolMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ProtocolMacroDto } from "../models/protocol-macros.model";

@Injectable()
export class ProtocolMacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listMacros(protocolId: string): Promise<Result<ProtocolMacroDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          protocolId: protocolMacros.protocolId,
          addedAt: protocolMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(macros, eq(protocolMacros.macroId, macros.id))
        .where(eq(protocolMacros.protocolId, protocolId))
        .orderBy(macros.name);
    });
  }

  async addMacros(protocolId: string, macroIds: string[]): Promise<Result<ProtocolMacroDto[]>> {
    return tryCatch(async () => {
      if (!macroIds.length) return [];
      await this.database
        .insert(protocolMacros)
        .values(macroIds.map((macroId) => ({ protocolId, macroId })))
        .onConflictDoNothing();
      return this.database
        .select({
          protocolId: protocolMacros.protocolId,
          addedAt: protocolMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(macros, eq(protocolMacros.macroId, macros.id))
        .where(
          and(eq(protocolMacros.protocolId, protocolId), inArray(protocolMacros.macroId, macroIds)),
        )
        .orderBy(macros.name);
    });
  }

  async removeMacro(protocolId: string, macroId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(protocolMacros)
        .where(and(eq(protocolMacros.protocolId, protocolId), eq(protocolMacros.macroId, macroId)));
      return undefined;
    });
  }
}
