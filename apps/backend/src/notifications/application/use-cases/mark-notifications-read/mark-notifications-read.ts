import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../core/repositories/notification.repository";

@Injectable()
export class MarkNotificationsReadUseCase {
  private readonly logger = new Logger(MarkNotificationsReadUseCase.name);

  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(recipientId: string, ids: string[]): Promise<Result<number>> {
    this.logger.log({
      msg: "Marking notifications read",
      operation: "markNotificationsRead",
      recipientId,
      count: ids.length,
    });

    return this.notificationRepository.markRead(recipientId, ids);
  }
}
