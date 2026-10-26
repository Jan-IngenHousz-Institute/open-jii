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
  isNotNull,
  isNull,
  lt,
  notificationPreferences,
  notifications,
  or,
  profiles,
  sql,
  users,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, SQL } from "@repo/database";

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

export interface RetentionPeriods {
  readAfterDays: number;
  allAfterDays: number;
  batchSize: number;
}

/** Postgres binds one parameter per column, so a single statement cannot take every row. */
const INSERT_CHUNK_SIZE = 1000;

export const NOTIFICATION_RETENTION_LOCK_KEY = "notifications_retention";

const RETENTION_LOCK = sql`hashtext(${NOTIFICATION_RETENTION_LOCK_KEY})`;

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
  async insertMany(
    rows: NotificationInsertRow[],
    handle: DbOrTx = this.database,
  ): Promise<Result<NotificationInsertedRow[]>> {
    return tryCatch(async () => {
      const inserted: NotificationInsertedRow[] = [];

      for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
        const written = await handle
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
   * the platform on their behalf. A closed account yields no address either: deletion
   * sets `deleted_at` and rewrites `users.email` to a `deleted-…@example.com` stand-in
   * without touching `activated`, which the anonymising projection alone would hand
   * out as a deliverable address.
   */
  async findUsers(ids: string[]): Promise<Result<NotificationUserDto[]>> {
    return tryCatch(async () => {
      if (ids.length === 0) {
        return [];
      }

      return this.database
        .select({
          id: users.id,
          email: sql<
            string | null
          >`CASE WHEN ${profiles.deletedAt} IS NULL THEN ${getAnonymizedEmail()} ELSE NULL END`,
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

  /**
   * A session lock, held across the delete batches with no transaction around them;
   * `false` means another task holds it. The task's client pools one connection
   * (`max: 1`), so every batch runs on the session that took the lock, and a transaction
   * would pin that one connection for every request in the task until the last batch. The
   * driver also recycles that one connection at the end of its lifetime, so a release now
   * and then finds the lock gone with the replaced session. If the pool ever grows, the
   * release can land on a session that never locked, and the lock then needs a reserved
   * connection.
   */
  async tryRetentionLock(): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const [row] = await this.database.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_lock(${RETENTION_LOCK}) AS locked`,
      );
      return row.locked;
    });
  }

  /**
   * Deletes up to `batchSize` notifications that arrived more than `readAfterDays` ago and
   * have been read, or more than `allAfterDays` ago whatever their state; their deliveries
   * go with them by cascade. Both cut-offs come from the database clock, the one
   * `created_at` and `read_at` are stamped by. The uncorrelated subquery runs once, so its
   * `LIMIT` caps the batch.
   */
  async deleteExpiredBatch({
    readAfterDays,
    allAfterDays,
    batchSize,
  }: RetentionPeriods): Promise<Result<number>> {
    return tryCatch(async () => {
      const readCutoff = sql`(now() AT TIME ZONE 'UTC') - make_interval(days => ${readAfterDays})`;
      const allCutoff = sql`(now() AT TIME ZONE 'UTC') - make_interval(days => ${allAfterDays})`;

      const expired = this.database
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            lt(notifications.createdAt, readCutoff),
            or(isNotNull(notifications.readAt), lt(notifications.createdAt, allCutoff)),
          ),
        )
        .limit(batchSize);

      const rows = await this.database
        .delete(notifications)
        .where(inArray(notifications.id, expired))
        .returning({ id: notifications.id });

      return rows.length;
    });
  }

  /** `false` when this session no longer held the lock. */
  async releaseRetentionLock(): Promise<Result<boolean>> {
    return tryCatch(async () => {
      const [row] = await this.database.execute<{ unlocked: boolean }>(
        sql`SELECT pg_advisory_unlock(${RETENTION_LOCK}) AS unlocked`,
      );
      return row.unlocked;
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

  /** The saved choices of several people for one category and channel; a missing row means the default applies. */
  async findPreferencesForUsers(
    userIds: string[],
    category: NotificationCategory,
    channel: NotificationChannel,
  ): Promise<Result<NotificationPreferenceRowDto[]>> {
    return tryCatch(() =>
      this.database
        .select()
        .from(notificationPreferences)
        .where(
          and(
            inArray(notificationPreferences.userId, userIds),
            eq(notificationPreferences.category, category),
            eq(notificationPreferences.channel, channel),
          ),
        ),
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
