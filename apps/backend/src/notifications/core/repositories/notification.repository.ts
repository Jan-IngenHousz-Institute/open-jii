import { Inject, Injectable } from "@nestjs/common";

import {
  NOTIFICATION_TYPES,
  zNotificationResourceType,
  zNotificationType,
} from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationResourceType,
  NotificationType,
} from "@repo/api/domains/notification/notification.schema";
import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  notificationPreferences,
  notifications,
  profiles,
  sql,
  users,
} from "@repo/database";
import type { DatabaseInstance, SQL } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import {
  getAnonymizedEmail,
  getAnonymizedFirstName,
  getAnonymizedLastName,
} from "../../../common/utils/profile-anonymization";
import type { NotificationDto, NotificationPreferenceRowDto } from "../models/notification.model";

export interface NotificationFilter {
  unreadOnly: boolean;
  types?: NotificationType[];
}

export interface NotificationInsertRow {
  recipientId: string;
  type: NotificationType;
  actorId: string | null;
  resourceType: NotificationResourceType | null;
  resourceId: string | null;
  params: Record<string, string>;
  dedupeKey: string | null;
}

export interface NotificationInsertedRow {
  id: string;
  recipientId: string;
}

export interface NotificationUserDto {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
}

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

@Injectable()
export class NotificationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  /**
   * One statement per chunk, returning only the rows that were actually written: a row
   * whose dedupe key is already taken is skipped, and the caller emails nobody about it.
   */
  async insertMany(rows: NotificationInsertRow[]): Promise<Result<NotificationInsertedRow[]>> {
    return tryCatch(async () => {
      const inserted: NotificationInsertedRow[] = [];

      for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        const written = await this.database
          .insert(notifications)
          .values(rows.slice(start, start + INSERT_CHUNK_SIZE))
          .onConflictDoNothing()
          .returning({ id: notifications.id, recipientId: notifications.recipientId });

        inserted.push(...written);
      }

      return inserted;
    });
  }

  /**
   * Who to address, for the recipients of a dispatch and its actor. A deactivated
   * profile yields no address and an anonymised name, so nothing identifying leaves
   * the platform on their behalf.
   */
  async findUsers(ids: string[]): Promise<Result<NotificationUserDto[]>> {
    return tryCatch(async () => {
      if (ids.length === 0) {
        return [];
      }

      return this.database
        .select({
          id: users.id,
          email: getAnonymizedEmail(),
          firstName: getAnonymizedFirstName(),
          lastName: getAnonymizedLastName(),
        })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(inArray(users.id, ids));
    });
  }

  /** Newest first, with the total counted separately so an out-of-range page still reports it. */
  async findPage(
    recipientId: string,
    filter: NotificationFilter,
    page: number,
    pageSize: number,
  ): Promise<Result<{ items: NotificationDto[]; totalCount: number }>> {
    return tryCatch(async () => {
      const where = this.pageCondition(recipientId, filter);

      const [countRow] = await this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(where);

      const rows = await this.database
        .select({
          id: notifications.id,
          type: notifications.type,
          actorId: notifications.actorId,
          actorFirstName: getAnonymizedFirstName(),
          actorLastName: getAnonymizedLastName(),
          resourceType: notifications.resourceType,
          resourceId: notifications.resourceId,
          params: notifications.params,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      // A type this build does not know, written by a newer deploy mid-rollout, is skipped.
      const items = rows.flatMap((row): NotificationDto[] => {
        const type = zNotificationType.safeParse(row.type);
        if (!type.success) return [];

        const resourceType = zNotificationResourceType.safeParse(row.resourceType);

        return [
          {
            id: row.id,
            type: type.data,
            category: NOTIFICATION_TYPES[type.data].category,
            actor: row.actorId
              ? { id: row.actorId, name: `${row.actorFirstName} ${row.actorLastName}` }
              : null,
            resource:
              resourceType.success && row.resourceId
                ? { type: resourceType.data, id: row.resourceId }
                : null,
            params: row.params,
            readAt: row.readAt,
            createdAt: row.createdAt,
          },
        ];
      });

      return { items, totalCount: countRow.count };
    });
  }

  async countUnread(recipientId: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const [row] = await this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)));

      return row.count;
    });
  }

  /** Ids that belong to someone else match no row, so they are ignored rather than refused. */
  async markRead(recipientId: string, ids: string[]): Promise<Result<number>> {
    return tryCatch(async () => {
      const updated = await this.database
        .update(notifications)
        .set({ readAt: sql`now() AT TIME ZONE 'UTC'` })
        .where(
          and(
            eq(notifications.recipientId, recipientId),
            inArray(notifications.id, ids),
            isNull(notifications.readAt),
          ),
        )
        .returning({ id: notifications.id });

      return updated.length;
    });
  }

  async markAllRead(recipientId: string): Promise<Result<number>> {
    return tryCatch(async () => {
      const updated = await this.database
        .update(notifications)
        .set({ readAt: sql`now() AT TIME ZONE 'UTC'` })
        .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)))
        .returning({ id: notifications.id });

      return updated.length;
    });
  }

  async findPreferences(userId: string): Promise<Result<NotificationPreferenceRowDto[]>> {
    return tryCatch(() =>
      this.database
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId)),
    );
  }

  async upsertPreference(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .insert(notificationPreferences)
        .values({ userId, category, channel, enabled })
        .onConflictDoUpdate({
          target: [
            notificationPreferences.userId,
            notificationPreferences.category,
            notificationPreferences.channel,
          ],
          set: { enabled },
        });
    });
  }

  private pageCondition(recipientId: string, filter: NotificationFilter): SQL | undefined {
    return and(
      eq(notifications.recipientId, recipientId),
      filter.unreadOnly ? isNull(notifications.readAt) : undefined,
      filter.types ? inArray(notifications.type, filter.types) : undefined,
    );
  }
}
