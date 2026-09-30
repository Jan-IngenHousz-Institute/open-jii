import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../core/repositories/notification.repository";

@Injectable()
export class MarkAllNotificationsReadUseCase {
  private readonly logger = new Logger(MarkAllNotificationsReadUseCase.name);

  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(recipientId: string): Promise<Result<number>> {
    this.logger.log({
      msg: "Marking all notifications read",
      operation: "markAllNotificationsRead",
      recipientId,
    });

    return this.notificationRepository.markAllRead(recipientId);
  }
}
