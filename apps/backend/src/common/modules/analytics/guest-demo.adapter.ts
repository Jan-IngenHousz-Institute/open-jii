import { Injectable } from "@nestjs/common";

import { FEATURE_FLAGS } from "@repo/analytics";
import { isFeatureFlagEnabled } from "@repo/analytics/server";

import type { DemoModePort } from "../../../authorization/core/ports/demo-mode.port";

@Injectable()
export class GuestDemoAdapter implements DemoModePort {
  isEnabled(): Promise<boolean> {
    // No cached true: an unavailable analytics boundary closes guest execution immediately.
    return isFeatureFlagEnabled(FEATURE_FLAGS.DEMO_MODE);
  }
}
