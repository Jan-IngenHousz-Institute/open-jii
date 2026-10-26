import { Injectable } from "@nestjs/common";

import { UploadRunReconcilerService } from "../experiments/application/services/upload-run-reconciler.service";

/**
 * The harness boots the whole application, so the real loop would follow uploads other specs
 * had only recorded and call Databricks for them. `reconcile()` stays real; specs call it.
 */
@Injectable()
export class QuietUploadRunReconcilerService extends UploadRunReconcilerService {
  // The schedule explorer reads the decorator's metadata off the instance's own method, and an
  // override carries none, so the interval is never registered.
  override async reconcileOnSchedule(): Promise<void> {
    return Promise.resolve();
  }
}
