import { Injectable, Logger } from "@nestjs/common";
import { render } from "@react-email/components";
import { createTransport, SentMessageInfo } from "nodemailer";

import { AddedUserNotification } from "@repo/transactional/emails/added-user-notification";

import { apiErrorMapper, tryCatch } from "../../../../utils/fp-utils";
import { EmailConfigService } from "../config/config.service";

interface ExtendedSentMessageInfo extends SentMessageInfo {
  rejected?: string[];
  pending?: string[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly emailConfigService: EmailConfigService) {}

  async sendAddedUserNotification(
    experimentId: string,
    experimentName: string,
    actor: string,
    role: string,
    email: string,
  ) {
    return await tryCatch(
      async () => {
        this.logger.log(
          `Sending added user notification to ${email} with role ${role} for experiment ${experimentId} by actor ${actor}`,
        );

        const { host } = new URL(this.emailConfigService.getBaseUrl());
        const { href: experimentUrl } = new URL(
          `/platform/experiments/${experimentId}`,
          this.emailConfigService.getBaseUrl(),
        );
        const transport = createTransport(this.emailConfigService.getServer());

        const emailHtml = await render(
          AddedUserNotification({ host, experimentName, experimentUrl, actor, role }),
          {},
        );
        const emailText = await render(
          AddedUserNotification({ host, experimentName, experimentUrl, actor, role }),
          {
            plainText: true,
          },
        );

        const result = transport.sendMail({
          to: email,
          from: {
            name: "openJII",
            address: this.emailConfigService.getFrom(),
          },
          subject: `Added to experiment on the openJII Platform`,
          html: emailHtml,
          text: emailText,
        });

        // Cast result to extended type to handle optional rejected/pending properties
        const extendedResult = result as ExtendedSentMessageInfo;
        const rejected: string[] = extendedResult.rejected ?? [];
        const pending: string[] = extendedResult.pending ?? [];
        const failed: string[] = rejected.concat(pending).filter(Boolean);

        if (failed.length > 0) {
          const failedAddresses = failed.map((failedAddress: string) =>
            typeof failedAddress === "object" && "address" in failedAddress
              ? (failedAddress as { address: string }).address
              : failedAddress,
          );
          throw new Error(`Email (${failedAddresses.join(", ")}) could not be sent`);
        }
      },
      (error) => {
        this.logger.error(`Failed to send email notification to {email}`, error);
        return apiErrorMapper(
          `Failed to send email: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      },
    );
  }
}
