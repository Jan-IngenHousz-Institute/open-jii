import { Injectable, Logger } from "@nestjs/common";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { ErrorCodes } from "../../../common/utils/error-codes";
import type { Result } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "./notification-dispatch.service";

/**
 * The one place a deletion notification is sent from. The caller reads the members,
 * and the name where its own row does not carry one, before the delete sweeps the
 * grants; a failure here is logged and never fails the delete.
 */
@Injectable()
export class ResourceDeletedNotifier {
  private readonly logger = new Logger(ResourceDeletedNotifier.name);

  constructor(private readonly notifications: NotificationDispatchService) {}

  async notify(input: {
    operation: string;
    actorId: string;
    resource: { type: SharingResourceType; id: string };
    name: string | Result<string | null>;
    members: Result<string[]>;
  }): Promise<void> {
    const { operation, actorId, resource, name, members } = input;
    const context = { operation, resourceType: resource.type, resourceId: resource.id };

    const resourceName = typeof name === "string" ? name : name.isSuccess() ? name.value : null;
    if (resourceName === null) {
      this.logger.error({
        msg: "Could not name the resource, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        ...context,
        ...(typeof name !== "string" && name.isFailure() ? { error: name.error } : {}),
      });
      return;
    }
    if (members.isFailure()) {
      this.logger.error({
        msg: "Could not read who had access, nobody was notified of the deletion",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        ...context,
        error: members.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "resource_deleted",
      recipientIds: members.value,
      actorId,
      resource,
      params: { resourceName },
    });

    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify members, the resource was still deleted",
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        ...context,
        error: dispatched.error,
      });
    }
  }
}
