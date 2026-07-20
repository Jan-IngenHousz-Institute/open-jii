import { Controller, Inject, Logger, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { newsletterContract } from "@repo/api/domains/newsletter/newsletter.contract";

import { NEWSLETTER_PORT } from "../core/ports/newsletter.port";
import type { NewsletterPort } from "../core/ports/newsletter.port";
import { NewsletterThrottlerGuard } from "./newsletter-throttler.guard";

/**
 * Public, unauthenticated newsletter subscribe endpoint. Rate-limited per IP
 * and enumeration-safe: it always returns the same generic response regardless
 * of whether the address is new, known, or the upsert failed.
 */
@Controller()
@AllowAnonymous()
@UseGuards(NewsletterThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class NewsletterSubscribeController {
  private readonly logger = new Logger(NewsletterSubscribeController.name);

  constructor(@Inject(NEWSLETTER_PORT) private readonly newsletter: NewsletterPort) {}

  @Implement(newsletterContract.subscribe)
  subscribe() {
    return implement(newsletterContract.subscribe).handler(async ({ input }) => {
      // Enumeration-safe: every outcome (failure, or an unexpected throw from
      // the port) yields the same generic response so membership never leaks.
      try {
        const result = await this.newsletter.subscribePending(input.email);
        if (result.isFailure()) {
          this.logger.warn({
            msg: "Newsletter subscribe failed; returning generic response",
            operation: "subscribe",
            errorCode: result.error.code,
          });
        }
      } catch (error) {
        this.logger.error({
          msg: "Newsletter subscribe threw; returning generic response",
          operation: "subscribe",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return { success: true as const };
    });
  }
}
