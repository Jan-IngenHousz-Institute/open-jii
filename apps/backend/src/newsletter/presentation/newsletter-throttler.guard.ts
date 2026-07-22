import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

interface ThrottledRequest {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}

// Keys the throttle on the second-from-right X-Forwarded-For entry: the viewer IP
// CloudFront appends. req.ip is the proxy (one shared bucket) and the leftmost entry
// is client-supplied (rotating it would mint a fresh bucket per request).
@Injectable()
export class NewsletterThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: ThrottledRequest): Promise<string> {
    const header = req.headers?.["x-forwarded-for"];
    const raw = Array.isArray(header) ? header.join(",") : header;
    const chain = (raw ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (chain.length >= 2) {
      return Promise.resolve(chain[chain.length - 2]);
    }
    if (chain.length === 1) {
      return Promise.resolve(chain[0]);
    }
    return Promise.resolve(req.ip ?? "");
  }
}
