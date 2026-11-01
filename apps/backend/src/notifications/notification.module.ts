import { Module } from "@nestjs/common";

import { AnalyticsAdapter } from "../common/modules/analytics/analytics.adapter";
import { AnalyticsModule } from "../common/modules/analytics/analytics.module";
import { EmailModule } from "../common/modules/email/services/email.module";
import { GuestRepositoryModule } from "../users/guest-repository.module";
// Services
import { NotificationDispatchService } from "./application/services/notification-dispatch.service";
import { NotificationEmailService } from "./application/services/notification-email.service";
import { NotificationOutboxWorker } from "./application/services/notification-outbox.worker";
import { NotificationPreferencesService } from "./application/services/notification-preferences.service";
import { NotificationRetentionService } from "./application/services/notification-retention.service";
import { ResourceDeletedNotifier } from "./application/services/resource-deleted-notifier";
// Use Cases
import { GetNotificationPreferencesUseCase } from "./application/use-cases/get-notification-preferences/get-notification-preferences";
import { GetUnreadNotificationCountUseCase } from "./application/use-cases/get-unread-notification-count/get-unread-notification-count";
import { ListNotificationsUseCase } from "./application/use-cases/list-notifications/list-notifications";
import { MarkAllNotificationsReadUseCase } from "./application/use-cases/mark-all-notifications-read/mark-all-notifications-read";
import { MarkNotificationsReadUseCase } from "./application/use-cases/mark-notifications-read/mark-notifications-read";
import { UpdateNotificationPreferenceUseCase } from "./application/use-cases/update-notification-preference/update-notification-preference";
// Ports
import { ANALYTICS_PORT } from "./core/ports/analytics.port";
// Repositories
import { NotificationDeliveryRepository } from "./core/repositories/notification-delivery.repository";
import { NotificationRepository } from "./core/repositories/notification.repository";
// Controllers
import { NotificationController } from "./presentation/notification.controller";

@Module({
  imports: [EmailModule, AnalyticsModule, GuestRepositoryModule],
  controllers: [NotificationController],
  providers: [
    // Ports
    {
      provide: ANALYTICS_PORT,
      useExisting: AnalyticsAdapter,
    },

    // Repositories
    NotificationRepository,
    NotificationDeliveryRepository,

    // Services
    NotificationDispatchService,
    NotificationEmailService,
    NotificationPreferencesService,
    NotificationOutboxWorker,
    NotificationRetentionService,
    ResourceDeletedNotifier,

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
  exports: [NotificationDispatchService, ResourceDeletedNotifier],
})
export class NotificationModule {}
