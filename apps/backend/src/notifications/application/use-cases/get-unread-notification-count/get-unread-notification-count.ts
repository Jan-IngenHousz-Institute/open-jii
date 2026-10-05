import { Injectable } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../core/repositories/notification.repository";

/** Polled by every open tab, so it stays a single indexed count and logs nothing. */
@Injectable()
export class GetUnreadNotificationCountUseCase {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(recipientId: string): Promise<Result<number>> {
    return this.notificationRepository.countUnread(recipientId);
  }
}
