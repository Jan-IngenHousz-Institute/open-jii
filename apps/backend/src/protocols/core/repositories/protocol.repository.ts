import { Injectable, Inject } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api/schemas/protocol.schema";
import {
  and,
  asc,
  eq,
  ensurePersonalOrganization,
  grantResource,
  ilike,
  inArray,
  protocols,
  users,
} from "@repo/database";
import { profiles } from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, success, tryCatch } from "../../../common/utils/fp-utils";
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
      const organizationId = await ensurePersonalOrganization(this.database, { id: userId });
      const results = await this.database
        .insert(protocols)
        .values({
          ...createProtocolDto,
          organizationId,
          createdBy: userId,
        })
        .returning();
      if (results.length > 0) {
        await grantResource(this.database, {
          resourceType: "protocol",
          resourceId: results[0].id,
          granteeType: "user",
          granteeId: userId,
          role: "admin",
          createdBy: userId,
        });
      }
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

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

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

  async findByIds(ids: string[]): Promise<Result<Map<string, ProtocolDto>>> {
    if (ids.length === 0) return success(new Map());
    return tryCatch(async () => {
      const rows = await this.database.select().from(protocols).where(inArray(protocols.id, ids));
      return new Map(rows.map((row) => [row.id, row as ProtocolDto]));
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

  async delete(id: string): Promise<Result<ProtocolDto[]>> {
    return tryCatch(async () => {
      const results = await this.database.delete(protocols).where(eq(protocols.id, id)).returning();

      return results as unknown as ProtocolDto[];
    });
  }
}
