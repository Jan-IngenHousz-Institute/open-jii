import { Module } from "@nestjs/common";

import { MailchimpAdapter } from "../common/modules/mailchimp/mailchimp.adapter";
import { MailchimpModule } from "../common/modules/mailchimp/mailchimp.module";
import { NEWSLETTER_PORT } from "./core/ports/newsletter.port";
import { NewsletterSubscribeController } from "./presentation/newsletter-subscribe.controller";
import { NewsletterThrottlerGuard } from "./presentation/newsletter-throttler.guard";
import { NewsletterController } from "./presentation/newsletter.controller";

@Module({
  imports: [MailchimpModule],
  controllers: [NewsletterController, NewsletterSubscribeController],
  providers: [
    NewsletterThrottlerGuard,
    {
      provide: NEWSLETTER_PORT,
      useExisting: MailchimpAdapter,
    },
  ],
})
export class NewsletterModule {}
