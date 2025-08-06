import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api";
import { desc, eq, ilike, protocols, experimentProtocols, users } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { CreateProtocolDto, UpdateProtocolDto, ProtocolDto } from "../models/protocol.model";

@Injectable()
export class ProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createProtocolDto: CreateProtocolDto,
    userId: string,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .insert(protocols)
        .values({
          ...createProtocolDto,
          createdBy: userId,
        })
        .returning();
      return results as ProtocolDto[];
    });
  }

  async findAll(search?: ProtocolFilter): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const query = this.database
        .select()
        .from(protocols)
        .innerJoin(users, eq(protocols.createdBy, users.id))
        .orderBy(desc(protocols.updatedAt));

      if (search) {
        query.where(ilike(protocols.name, `%${search}%`));
      }

      const results = await query;
      return results.map((result) => {
        const augmentedResult = result.protocols as unknown as ProtocolDto;
        augmentedResult.createdByName = result.users.name ?? undefined;
        return augmentedResult;
      });
    });
  }

  async findOne(id: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(protocols)
        .innerJoin(users, eq(protocols.createdBy, users.id))
        .where(eq(protocols.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as unknown as ProtocolDto;
      augmentedResult.createdByName = result[0].users.name ?? undefined;
      return augmentedResult;
    });
  }

  async findByName(name: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(protocols)
        .innerJoin(users, eq(protocols.createdBy, users.id))
        .where(eq(protocols.name, name))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as unknown as ProtocolDto;
      augmentedResult.createdByName = result[0].users.name ?? undefined;
      return augmentedResult;
    });
  }

  async update(id: string, updateProtocolDto: UpdateProtocolDto): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(protocols)
        .set({
          ...updateProtocolDto,
          updatedAt: new Date(),
        })
        .where(eq(protocols.id, id))
        .returning();

      return results as unknown as ProtocolDto[];
    });
  }

  async delete(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(protocols).where(eq(protocols.id, id)).returning();

      return results as unknown as ProtocolDto[];
    });
  }

  async isAssignedToAnyExperiment(protocolId: string): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(experimentProtocols)
        .where(eq(experimentProtocols.protocolId, protocolId))
        .limit(1);
      return result.length > 0;
    });
  }
}
