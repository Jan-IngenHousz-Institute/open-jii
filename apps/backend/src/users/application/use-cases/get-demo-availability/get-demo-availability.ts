import { Inject, Injectable } from "@nestjs/common";

import { DEMO_MODE_PORT } from "../../../../authorization/core/ports/demo-mode.port";
import type { DemoModePort } from "../../../../authorization/core/ports/demo-mode.port";

@Injectable()
export class GetDemoAvailabilityUseCase {
  private cached?: { enabled: boolean; until: number };
  private pending?: Promise<{ enabled: boolean }>;

  constructor(@Inject(DEMO_MODE_PORT) private readonly demoMode: DemoModePort) {}

  execute(): Promise<{ enabled: boolean }> {
    if (this.cached && Date.now() < this.cached.until) {
      return Promise.resolve({ enabled: this.cached.enabled });
    }
    if (this.pending) return this.pending;
    // Login views share one billed flag read; admission still checks the flag live.
    this.pending = Promise.resolve()
      .then(() => this.demoMode.isEnabled())
      .catch(() => false)
      .then((enabled) => {
        this.cached = { enabled: enabled === true, until: Date.now() + 30_000 };
        return { enabled: this.cached.enabled };
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
}
