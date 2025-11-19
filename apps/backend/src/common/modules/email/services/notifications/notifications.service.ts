import { Injectable, Logger } from "@nestjs/common";
import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import Mail from "nodemailer/lib/mailer";

import { AddedUserNotification } from "@repo/transactional/emails/added-user-notification";

import { apiErrorMapper, tryCatch } from "../../../../utils/fp-utils";
import { EmailConfigService } from "../config/config.service";

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

        const result = await transport.sendMail({
          to: email,
          from: {
            name: "openJII",
            address: this.emailConfigService.getFrom(),
          },
          subject: `Added to experiment on the openJII Platform`,
          html: emailHtml,
          text: emailText,
        });

        // Handle rejected and pending addresses
        const rejected: (string | Mail.Address)[] = result.rejected;
        const pending: (string | Mail.Address)[] = result.pending;
        const failed: (string | Mail.Address)[] = rejected.concat(pending).filter(Boolean);

        const isAddress = (addr: string | Mail.Address): addr is Mail.Address => {
          return typeof addr === "object" && "address" in addr;
        };

        if (failed.length > 0) {
          const failedAddresses = failed.map((failedAddress) =>
            isAddress(failedAddress) ? failedAddress.address : failedAddress,
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
