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
import { CreateProtocolDto, ProtocolDto } from "../models/protocol.model";

@Injectable()
export class ProtocolRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * Create a new protocol (v1) or a new version of an existing protocol.
   * For v1: pass data without id (will be auto-generated).
   * For new version: pass data with the same id and incremented version.
   */
  async create(
    createProtocolDto: CreateProtocolDto,
    userId: string,
  ): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .insert(protocols)
        .values({
          ...createProtocolDto,
          id: createProtocolDto.id ?? crypto.randomUUID(),
          version: createProtocolDto.version ?? 1,
          createdBy: userId,
        })
        .returning();
      return results as ProtocolDto[];
    });
  }

  /**
   * List protocols, returning only the latest version of each.
   */
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

      // Only return the latest version of each protocol (by id)
      conditions.push(
        sql`${protocols.version} = (SELECT MAX(p2.version) FROM protocols p2 WHERE p2.id = ${protocols.id})`,
      );

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

  /**
   * Find a protocol by id. If version is provided, returns that exact version.
   * Otherwise returns the latest version.
   */
  async findOne(id: string, version?: number): Promise<Result<ProtocolDto | null>> {
    return tryCatch(async () => {
      const conditions = [eq(protocols.id, id)];
      if (version !== undefined) {
        conditions.push(eq(protocols.version, version));
      } else {
        conditions.push(
          sql`${protocols.version} = (SELECT MAX(p2.version) FROM protocols p2 WHERE p2.id = ${id})`,
        );
      }

      const result = await this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .where(and(...conditions))
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
        .orderBy(desc(protocols.version))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const augmentedResult = result[0].protocols as unknown as ProtocolDto;
      augmentedResult.createdByName = result[0].users.name || undefined;
      return augmentedResult;
    });
  }

  /**
   * Find all versions of a protocol by id, ordered by version descending.
   */
  async findVersionsById(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          protocols,
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(protocols)
        .innerJoin(profiles, eq(protocols.createdBy, profiles.userId))
        .where(eq(protocols.id, id))
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
   * Get the highest version number for a given protocol id.
   * Returns 0 if no protocol with that id exists.
   */
  async findMaxVersion(id: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ maxVersion: max(protocols.version) })
        .from(protocols)
        .where(eq(protocols.id, id));

      return result[0]?.maxVersion ?? 0;
    });
  }

  async delete(id: string, version?: number): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const conditions = [eq(protocols.id, id)];
      if (version !== undefined) {
        conditions.push(eq(protocols.version, version));
      }
      const results = await this.database
        .delete(protocols)
        .where(and(...conditions))
        .returning();

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
