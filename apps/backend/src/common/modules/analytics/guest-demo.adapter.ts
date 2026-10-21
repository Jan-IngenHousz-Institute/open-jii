import { Injectable } from "@nestjs/common";

import { isDemoModeEnabled } from "@repo/analytics/server";

import type { DemoModePort } from "../../../authorization/core/ports/demo-mode.port";

@Injectable()
export class GuestDemoAdapter implements DemoModePort {
  isEnabled(): Promise<boolean> {
    // No cached true: an unavailable analytics boundary closes guest execution immediately.
    return isDemoModeEnabled();
  }
}
