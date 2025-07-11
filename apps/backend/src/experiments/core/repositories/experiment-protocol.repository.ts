import { Injectable, Inject } from "@nestjs/common";

import { and, eq, experimentProtocols, inArray, protocols } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { ExperimentProtocolDto } from "../models/experiment-protocols.model";

@Injectable()
export class ExperimentProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async listProtocols(experimentId: string): Promise<Result<ExperimentProtocolDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          experimentId: experimentProtocols.experimentId,
          order: experimentProtocols.order,
          addedAt: experimentProtocols.addedAt,
          protocol: {
            id: protocols.id,
            name: protocols.name,
            family: protocols.family,
            createdby: protocols.createdBy,
          },
        })
        .from(experimentProtocols)
        .innerJoin(protocols, eq(experimentProtocols.protocolId, protocols.id))
        .where(eq(experimentProtocols.experimentId, experimentId))
        .orderBy(experimentProtocols.order);
    });
  }

  async addProtocols(
    experimentId: string,
    protocolsToAdd: { protocolId: string; order?: number }[],
  ): Promise<Result<ExperimentProtocolDto[]>> {
    return tryCatch(async () => {
      if (!protocolsToAdd.length) return [];
      await this.database.insert(experimentProtocols).values(
        protocolsToAdd.map((p, idx) => ({
          experimentId,
          protocolId: p.protocolId,
          order: p.order ?? idx,
        })),
      );
      const protocolIds = protocolsToAdd.map((p) => p.protocolId);
      return this.database
        .select({
          experimentId: experimentProtocols.experimentId,
          order: experimentProtocols.order,
          addedAt: experimentProtocols.addedAt,
          protocol: {
            id: protocols.id,
            name: protocols.name,
            family: protocols.family,
            createdby: protocols.createdBy,
          },
        })
        .from(experimentProtocols)
        .innerJoin(protocols, eq(experimentProtocols.protocolId, protocols.id))
        .where(
          and(
            eq(experimentProtocols.experimentId, experimentId),
            inArray(experimentProtocols.protocolId, protocolIds),
          ),
        )
        .orderBy(experimentProtocols.order);
    });
  }

  async removeProtocols(experimentId: string, protocolIds: string[]): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(experimentProtocols)
        .where(
          and(
            eq(experimentProtocols.experimentId, experimentId),
            inArray(experimentProtocols.protocolId, protocolIds),
          ),
        );
      return undefined;
    });
  }

  async updateProtocolOrder(
    experimentId: string,
    protocolId: string,
    order: number,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(experimentProtocols)
        .set({ order })
        .where(
          and(
            eq(experimentProtocols.experimentId, experimentId),
            eq(experimentProtocols.protocolId, protocolId),
          ),
        );
      return undefined;
    });
  }
}
