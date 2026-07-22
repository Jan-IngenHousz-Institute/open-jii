import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { newsletterContract } from "@repo/api/domains/newsletter/newsletter.contract";

import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { NEWSLETTER_PORT } from "../core/ports/newsletter.port";
import type { NewsletterPort } from "../core/ports/newsletter.port";

/**
 * Authenticated newsletter endpoints. All operate on the session user's own
 * email only; Mailchimp is the source of truth for the reported status.
 */
@Controller()
export class NewsletterController {
  private readonly logger = new Logger(NewsletterController.name);

  constructor(@Inject(NEWSLETTER_PORT) private readonly newsletter: NewsletterPort) {}

  @Implement(newsletterContract.getStatus)
  getStatus(@Session() session: UserSession) {
    return implement(newsletterContract.getStatus).handler(async () => {
      const email = this.requireEmail(session);
      const result = await this.newsletter.getStatus(email);
      if (result.isSuccess()) {
        return { status: result.value };
      }
      return throwOrpcFailure(result, this.logger, "getStatus");
    });
  }

  @Implement(newsletterContract.subscribeDirect)
  subscribeDirect(@Session() session: UserSession) {
    return implement(newsletterContract.subscribeDirect).handler(async () => {
      const email = this.requireEmail(session);
      const result = await this.newsletter.subscribeDirect(email);
      if (result.isSuccess()) {
        this.logger.log({
          msg: "Newsletter direct subscribe",
          operation: "subscribeDirect",
          status: result.value,
        });
        return { status: result.value };
      }
      return throwOrpcFailure(result, this.logger, "subscribeDirect");
    });
  }

  @Implement(newsletterContract.unsubscribe)
  unsubscribe(@Session() session: UserSession) {
    return implement(newsletterContract.unsubscribe).handler(async () => {
      const email = this.requireEmail(session);
      const result = await this.newsletter.unsubscribe(email);
      if (result.isSuccess()) {
        return { status: "unsubscribed" as const };
      }
      return throwOrpcFailure(result, this.logger, "unsubscribe");
    });
  }

  private requireEmail(session: UserSession): string {
    const email = session.user.email;
    if (!email) {
      return throwOrpcError(
        AppError.badRequest("No email address on the current session"),
        this.logger,
        "newsletter",
      );
    }
    return email;
  }
}
