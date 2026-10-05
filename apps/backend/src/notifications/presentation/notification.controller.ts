import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { notificationContract } from "@repo/api/domains/notification/notification.contract";
import { DEFAULT_PAGE_SIZE } from "@repo/api/shared/listing";

import { formatDatesList } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { toPage } from "../../common/utils/pagination";
import { GetNotificationPreferencesUseCase } from "../application/use-cases/get-notification-preferences/get-notification-preferences";
import { GetUnreadNotificationCountUseCase } from "../application/use-cases/get-unread-notification-count/get-unread-notification-count";
import { ListNotificationsUseCase } from "../application/use-cases/list-notifications/list-notifications";
import { MarkAllNotificationsReadUseCase } from "../application/use-cases/mark-all-notifications-read/mark-all-notifications-read";
import { MarkNotificationsReadUseCase } from "../application/use-cases/mark-notifications-read/mark-notifications-read";
import { UpdateNotificationPreferenceUseCase } from "../application/use-cases/update-notification-preference/update-notification-preference";

/** Every route acts on the caller's own notifications, so none needs a resource guard. */
@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly getUnreadNotificationCountUseCase: GetUnreadNotificationCountUseCase,
    private readonly markNotificationsReadUseCase: MarkNotificationsReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly getNotificationPreferencesUseCase: GetNotificationPreferencesUseCase,
    private readonly updateNotificationPreferenceUseCase: UpdateNotificationPreferenceUseCase,
  ) {}

  @Implement(notificationContract.listNotifications)
  listNotifications(@Session() session: UserSession) {
    return implement(notificationContract.listNotifications).handler(async ({ input }) => {
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

      const result = await this.listNotificationsUseCase.execute(session.user.id, {
        unreadOnly: input.readState === "unread",
        category: input.category,
        page,
        pageSize,
      });

      if (result.isSuccess()) {
        return toPage(result.value, page, pageSize, formatDatesList);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.getUnreadNotificationCount)
  getUnreadNotificationCount(@Session() session: UserSession) {
    return implement(notificationContract.getUnreadNotificationCount).handler(async () => {
      const result = await this.getUnreadNotificationCountUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return { count: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.markNotificationsRead)
  markNotificationsRead(@Session() session: UserSession) {
    return implement(notificationContract.markNotificationsRead).handler(async ({ input }) => {
      const result = await this.markNotificationsReadUseCase.execute(session.user.id, input.ids);

      if (result.isSuccess()) {
        return { updated: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.markAllNotificationsRead)
  markAllNotificationsRead(@Session() session: UserSession) {
    return implement(notificationContract.markAllNotificationsRead).handler(async () => {
      const result = await this.markAllNotificationsReadUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return { updated: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.getNotificationPreferences)
  getNotificationPreferences(@Session() session: UserSession) {
    return implement(notificationContract.getNotificationPreferences).handler(async () => {
      const result = await this.getNotificationPreferencesUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return { preferences: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.updateNotificationPreference)
  updateNotificationPreference(@Session() session: UserSession) {
    return implement(notificationContract.updateNotificationPreference).handler(
      async ({ input }) => {
        const result = await this.updateNotificationPreferenceUseCase.execute(
          session.user.id,
          input,
        );

        if (result.isSuccess()) {
          return { preferences: result.value };
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
