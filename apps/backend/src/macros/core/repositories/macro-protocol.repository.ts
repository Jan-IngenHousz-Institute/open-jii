import { Injectable, Inject } from "@nestjs/common";

import { and, eq, inArray, protocols, protocolMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { MacroProtocolDto } from "../models/macro-protocol.model";

@Injectable()
export class MacroProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listProtocols(macroId: string): Promise<Result<MacroProtocolDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          macroId: protocolMacros.macroId,
          addedAt: protocolMacros.addedAt,
          protocol: {
            id: protocols.id,
            name: protocols.name,
            version: protocols.version,
            family: protocols.family,
            createdBy: protocols.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(protocols, eq(protocolMacros.protocolId, protocols.id))
        .where(eq(protocolMacros.macroId, macroId))
        .orderBy(protocols.name);
    });
  }

  async addProtocols(macroId: string, protocolIds: string[]): Promise<Result<MacroProtocolDto[]>> {
    return tryCatch(async () => {
      if (!protocolIds.length) return [];
      await this.database
        .insert(protocolMacros)
        .values(protocolIds.map((protocolId) => ({ macroId, protocolId })))
        .onConflictDoNothing();
      return this.database
        .select({
          macroId: protocolMacros.macroId,
          addedAt: protocolMacros.addedAt,
          protocol: {
            id: protocols.id,
            name: protocols.name,
            version: protocols.version,
            family: protocols.family,
            createdBy: protocols.createdBy,
          },
        })
        .from(protocolMacros)
        .innerJoin(protocols, eq(protocolMacros.protocolId, protocols.id))
        .where(
          and(eq(protocolMacros.macroId, macroId), inArray(protocolMacros.protocolId, protocolIds)),
        )
        .orderBy(protocols.name);
    });
  }

  async removeProtocol(macroId: string, protocolId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(protocolMacros)
        .where(and(eq(protocolMacros.macroId, macroId), eq(protocolMacros.protocolId, protocolId)));
      return undefined;
    });
  }

  /**
   * Copy all protocol compatibility links from one macro to another (used during versioning).
   */
  async copyLinksToNewMacro(fromMacroId: string, toMacroId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      const existing = await this.database
        .select({ protocolId: protocolMacros.protocolId })
        .from(protocolMacros)
        .where(eq(protocolMacros.macroId, fromMacroId));

      if (existing.length > 0) {
        await this.database
          .insert(protocolMacros)
          .values(existing.map((row) => ({ macroId: toMacroId, protocolId: row.protocolId })))
          .onConflictDoNothing();
      }
      return undefined;
    });
  }

  /**
   * Check if a protocol exists by ID.
   * Used to validate protocol IDs without importing ProtocolModule (avoids circular dependency).
   */
  async findProtocolById(
    protocolId: string,
  ): Promise<Result<{ id: string; name: string; family: string; createdBy: string } | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          id: protocols.id,
          name: protocols.name,
          family: protocols.family,
          createdBy: protocols.createdBy,
        })
        .from(protocols)
        .where(eq(protocols.id, protocolId))
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }
}
