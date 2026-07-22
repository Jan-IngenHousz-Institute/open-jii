import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

import { MailchimpConfigService } from "./config/config.service";
import { MailchimpAdapter } from "./mailchimp.adapter";

@Module({
  imports: [HttpModule],
  providers: [MailchimpAdapter, MailchimpConfigService],
  exports: [MailchimpAdapter],
})
export class MailchimpModule {}
