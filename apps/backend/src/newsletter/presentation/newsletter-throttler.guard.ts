import { BadRequestException, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { CLIENT_ADDRESS_UNAVAILABLE, resolveClientAddress } from "@repo/auth/client-address";
import type { ClientAddressRequest } from "@repo/auth/client-address";

@Injectable()
export class NewsletterThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ClientAddressRequest): Promise<string> {
    const address = resolveClientAddress(req);
    if (!address) throw new BadRequestException(CLIENT_ADDRESS_UNAVAILABLE);
    return Promise.resolve(address);
  }
}
