import { BadRequestException, Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { CLIENT_ADDRESS_UNAVAILABLE, resolveClientAddress } from "@repo/auth/client-address";
import type { ClientAddressRequest } from "@repo/auth/client-address";

interface ThrottledRequest extends ClientAddressRequest {
  session?: { user?: { id?: string } };
}

@Injectable()
export class JoinCodeThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ThrottledRequest): Promise<string> {
    const userId = req.session?.user?.id;
    if (userId) return Promise.resolve(userId);
    const address = resolveClientAddress(req);
    if (!address) throw new BadRequestException(CLIENT_ADDRESS_UNAVAILABLE);
    return Promise.resolve(address);
  }
}
