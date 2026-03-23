import { Injectable, Inject } from "@nestjs/common";

import { and, eq, sql, protocols, protocolMacros } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { MacroProtocolDto } from "../models/macro-protocol.model";

@Injectable()
export class MacroProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listProtocols(macroId: string, macroVersion: number): Promise<Result<MacroProtocolDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          macroId: protocolMacros.macroId,
          macroVersion: protocolMacros.macroVersion,
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
        .innerJoin(
          protocols,
          and(
            eq(protocolMacros.protocolId, protocols.id),
            eq(protocolMacros.protocolVersion, protocols.version),
          ),
        )
        .where(
          and(eq(protocolMacros.macroId, macroId), eq(protocolMacros.macroVersion, macroVersion)),
        )
        .orderBy(protocols.name);
    });
  }

  async addProtocols(
    macroId: string,
    macroVersion: number,
    protocolRefs: { id: string; version: number }[],
  ): Promise<Result<MacroProtocolDto[]>> {
    return tryCatch(async () => {
      if (!protocolRefs.length) return [];
      await this.database
        .insert(protocolMacros)
        .values(
          protocolRefs.map((ref) => ({
            macroId,
            macroVersion,
            protocolId: ref.id,
            protocolVersion: ref.version,
          })),
        )
        .onConflictDoNothing();

      const protocolIds = protocolRefs.map((ref) => ref.id);
      return this.database
        .select({
          macroId: protocolMacros.macroId,
          macroVersion: protocolMacros.macroVersion,
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
        .innerJoin(
          protocols,
          and(
            eq(protocolMacros.protocolId, protocols.id),
            eq(protocolMacros.protocolVersion, protocols.version),
          ),
        )
        .where(
          and(
            eq(protocolMacros.macroId, macroId),
            eq(protocolMacros.macroVersion, macroVersion),
            sql`${protocolMacros.protocolId} IN (${sql.join(
              protocolIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        )
        .orderBy(protocols.name);
    });
  }

  async removeProtocol(
    macroId: string,
    macroVersion: number,
    protocolId: string,
    protocolVersion: number,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(protocolMacros)
        .where(
          and(
            eq(protocolMacros.macroId, macroId),
            eq(protocolMacros.macroVersion, macroVersion),
            eq(protocolMacros.protocolId, protocolId),
            eq(protocolMacros.protocolVersion, protocolVersion),
          ),
        );
      return undefined;
    });
  }

  /**
   * Check if a protocol exists by ID (latest version).
   */
  async findProtocolById(
    protocolId: string,
  ): Promise<Result<{ id: string; name: string; version: number; family: string; createdBy: string } | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          id: protocols.id,
          name: protocols.name,
          version: protocols.version,
          family: protocols.family,
          createdBy: protocols.createdBy,
        })
        .from(protocols)
        .where(eq(protocols.id, protocolId))
        .orderBy(sql`${protocols.version} DESC`)
        .limit(1);

      return result.length > 0 ? result[0] : null;
    });
  }
}
