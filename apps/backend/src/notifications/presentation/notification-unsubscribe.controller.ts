import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { notificationContract } from "@repo/api/domains/notification/notification.contract";

import { ClientIpThrottlerGuard } from "../../common/guards/client-ip-throttler.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { SetEmailPreferenceByTokenUseCase } from "../application/use-cases/set-email-preference-by-token/set-email-preference-by-token";

/** The signed token in the path is the only credential, for the web page and for mail clients. */
@Controller()
@AllowAnonymous()
@UseGuards(ClientIpThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class NotificationUnsubscribeController {
  private readonly logger = new Logger(NotificationUnsubscribeController.name);

  constructor(
    private readonly setEmailPreferenceByTokenUseCase: SetEmailPreferenceByTokenUseCase,
  ) {}

  @Implement(notificationContract.unsubscribeEmailByToken)
  unsubscribeEmailByToken() {
    return implement(notificationContract.unsubscribeEmailByToken).handler(async ({ input }) => {
      const result = await this.setEmailPreferenceByTokenUseCase.execute(input.token, false);

      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(notificationContract.resubscribeEmailByToken)
  resubscribeEmailByToken() {
    return implement(notificationContract.resubscribeEmailByToken).handler(async ({ input }) => {
      const result = await this.setEmailPreferenceByTokenUseCase.execute(input.token, true);

      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
