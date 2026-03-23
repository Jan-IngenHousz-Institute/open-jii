import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api";
import {
  and,
  desc,
  eq,
  ilike,
  max,
  sql,
  protocols,
  experimentProtocols,
  users,
  asc,
  profiles,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
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

  async findAll(
    search?: ProtocolFilter,
    filter?: "my",
    userId?: string,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      let query = this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .orderBy(asc(protocols.sortOrder), asc(protocols.name));

      const conditions: (SQL | undefined)[] = [];

      if (search) {
        conditions.push(ilike(protocols.name, `%${search}%`));
      }

      if (filter === "my" && userId) {
        conditions.push(eq(protocols.createdBy, userId));
      }

      // Only return the latest version of each protocol
      conditions.push(
        sql`${protocols.version} = (SELECT MAX(p2.version) FROM protocols p2 WHERE p2.name = ${protocols.name})`,
      );

      // Apply all conditions with AND logic
      query = query.where(and(...conditions)) as typeof query;

      const results = await query;
      return results.map((result) => {
        const augmentedResult = result.protocols as ProtocolDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmentedResult.createdByName =
          firstName && lastName ? `${firstName} ${lastName}` : undefined;
        return augmentedResult;
      });
    });
  }

  async findOne(id: string): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .where(eq(protocols.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as ProtocolDto;
      const firstName = result[0].firstName;
      const lastName = result[0].lastName;
      augmentedResult.createdByName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;
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
      augmentedResult.createdByName = result[0].users.name || undefined;
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

  /**
   * Find all versions of a protocol by name, ordered by version descending.
   */
  async findVersionsByName(name: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .where(eq(protocols.name, name))
        .orderBy(desc(protocols.version));

      return results.map((result) => {
        const augmentedResult = result.protocols as ProtocolDto;
        const firstName = result.firstName;
        const lastName = result.lastName;
        augmentedResult.createdByName =
          firstName && lastName ? `${firstName} ${lastName}` : undefined;
        return augmentedResult;
      });
    });
  }

  /**
   * Get the highest version number for a given protocol name.
   * Returns 0 if no protocol with that name exists.
   */
  async findMaxVersionByName(name: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ maxVersion: max(protocols.version) })
        .from(protocols)
        .where(eq(protocols.name, name));

      return result[0]?.maxVersion ?? 0;
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
