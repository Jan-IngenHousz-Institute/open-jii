import { Injectable } from "@nestjs/common";

import {
  NOTIFICATION_CATEGORIES,
  zNotificationCategory,
  zNotificationChannel,
} from "@repo/api/domains/notification/notification.schema";
import type {
  NotificationCategory,
  NotificationPreference,
} from "@repo/api/domains/notification/notification.schema";

import { Result, success } from "../../../common/utils/fp-utils";
import { NotificationRepository } from "../../core/repositories/notification.repository";

/**
 * A person's choice for every category and channel, saved or defaulted. Shared by the
 * settings read and write, and by whatever decides whether an event sends an email.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async resolve(userId: string): Promise<Result<NotificationPreference[]>> {
    const saved = await this.notificationRepository.findPreferences(userId);
    if (saved.isFailure()) {
      return saved;
    }

    const savedChoice = new Map(
      saved.value.map((row) => [`${row.category}:${row.channel}`, row.enabled]),
    );

    return success(
      zNotificationCategory.options.flatMap((category) =>
        zNotificationChannel.options.map((channel) => {
          const fallback = NOTIFICATION_CATEGORIES[category][channel];
          const enabled =
            fallback.locked || (savedChoice.get(`${category}:${channel}`) ?? fallback.enabled);
          return { category, channel, enabled, locked: fallback.locked };
        }),
      ),
    );
  }

  /**
   * Who among `userIds` has email on for `category`: their saved choice, or the
   * category default when they never saved one. A locked category is on for everyone.
   */
  async emailEnabledFor(
    userIds: string[],
    category: NotificationCategory,
  ): Promise<Result<Set<string>>> {
    const fallback = NOTIFICATION_CATEGORIES[category].email;
    if (fallback.locked || userIds.length === 0) {
      return success(new Set(userIds));
    }

    const saved = await this.notificationRepository.findPreferencesForUsers(
      userIds,
      category,
      "email",
    );
    if (saved.isFailure()) {
      return saved;
    }

    const choice = new Map(saved.value.map((row) => [row.userId, row.enabled]));
    return success(new Set(userIds.filter((id) => choice.get(id) ?? fallback.enabled)));
  }
}
