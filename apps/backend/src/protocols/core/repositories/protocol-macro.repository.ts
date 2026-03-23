import { Injectable, Inject } from "@nestjs/common";

import { and, eq, sql, macros, protocolMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ProtocolMacroDto } from "../models/protocol-macro.model";

@Injectable()
export class ProtocolMacroRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listMacros(
    protocolId: string,
    protocolVersion: number,
  ): Promise<Result<ProtocolMacroDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          protocolId: protocolMacros.protocolId,
          protocolVersion: protocolMacros.protocolVersion,
          addedAt: protocolMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            version: macros.version,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(
          macros,
          and(
            eq(protocolMacros.macroId, macros.id),
            eq(protocolMacros.macroVersion, macros.version),
          ),
        )
        .where(
          and(
            eq(protocolMacros.protocolId, protocolId),
            eq(protocolMacros.protocolVersion, protocolVersion),
          ),
        )
        .orderBy(macros.name);
    });
  }

  async addMacros(
    protocolId: string,
    protocolVersion: number,
    macroRefs: { id: string; version: number }[],
  ): Promise<Result<ProtocolMacroDto[]>> {
    return tryCatch(async () => {
      if (!macroRefs.length) return [];
      await this.database
        .insert(protocolMacros)
        .values(
          macroRefs.map((ref) => ({
            protocolId,
            protocolVersion,
            macroId: ref.id,
            macroVersion: ref.version,
          })),
        )
        .onConflictDoNothing();

      const macroIds = macroRefs.map((ref) => ref.id);
      return this.database
        .select({
          protocolId: protocolMacros.protocolId,
          protocolVersion: protocolMacros.protocolVersion,
          addedAt: protocolMacros.addedAt,
          macro: {
            id: macros.id,
            name: macros.name,
            version: macros.version,
            filename: macros.filename,
            language: macros.language,
            createdBy: macros.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(
          macros,
          and(
            eq(protocolMacros.macroId, macros.id),
            eq(protocolMacros.macroVersion, macros.version),
          ),
        )
        .where(
          and(
            eq(protocolMacros.protocolId, protocolId),
            eq(protocolMacros.protocolVersion, protocolVersion),
            sql`${protocolMacros.macroId} IN (${sql.join(
              macroIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        )
        .orderBy(macros.name);
    });
  }

  async removeMacro(
    protocolId: string,
    protocolVersion: number,
    macroId: string,
    macroVersion: number,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(protocolMacros)
        .where(
          and(
            eq(protocolMacros.protocolId, protocolId),
            eq(protocolMacros.protocolVersion, protocolVersion),
            eq(protocolMacros.macroId, macroId),
            eq(protocolMacros.macroVersion, macroVersion),
          ),
        );
      return undefined;
    });
  }
}
