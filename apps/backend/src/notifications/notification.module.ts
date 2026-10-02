import { Module } from "@nestjs/common";

import { EmailModule } from "../common/modules/email/services/email.module";
// Services
import { NotificationDispatchService } from "./application/services/notification-dispatch.service";
import { NotificationEmailService } from "./application/services/notification-email.service";
import { NotificationPreferencesService } from "./application/services/notification-preferences.service";
// Use Cases
import { GetNotificationPreferencesUseCase } from "./application/use-cases/get-notification-preferences/get-notification-preferences";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count/get-unread-notification-count";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications/list-notifications";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read/mark-all-notifications-read";
import { MarkNotificationsReadUseCase } from "./application/use-cases/mark-notifications-read/mark-notifications-read";
import { UpdateNotificationPreferenceUseCase } from "./application/use-cases/update-notification-preference/update-notification-preference";
// Repositories
import { NotificationRepository } from "./core/repositories/notification.repository";
// Controllers
import { NotificationController } from "./presentation/notification.controller";

@Module({
  imports: [EmailModule],
  controllers: [NotificationController],
  providers: [
    // Repositories
    NotificationRepository,

    // Services
    NotificationDispatchService,
    NotificationEmailService,
    NotificationPreferencesService,

    // Use cases
    ListNotificationsUseCase,
    GetUnreadNotificationCountUseCase,
    MarkNotificationsReadUseCase,
    MarkAllNotificationsReadUseCase,
    GetNotificationPreferencesUseCase,
    UpdateNotificationPreferenceUseCase,
  ],
  // Producers inject the dispatch service directly; it is an in-process domain
  // service, not infrastructure behind a port.
  exports: [NotificationDispatchService],
})
export class NotificationModule {}
