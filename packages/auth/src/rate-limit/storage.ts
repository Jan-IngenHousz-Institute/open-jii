import type { BetterAuthOptions } from "better-auth";
import { createHmac } from "node:crypto";

import type { DbOrTx } from "@repo/database";

import {
  consumeRateLimitCounter,
  readRateLimitCounter,
  writeRateLimitCounter,
} from "./rate-limit.repository";

type Storage = NonNullable<NonNullable<BetterAuthOptions["rateLimit"]>["customStorage"]>;

export function hashRateLimitIdentity(secret: string, kind: "address" | "email", identity: string) {
  if (!secret) throw new Error("Auth secret is required for private rate limit counters");
  return createHmac("sha256", secret)
    .update(JSON.stringify([kind, identity]))
    .digest("hex");
}

export function createRateLimitStorage(
  database: DbOrTx,
  options: { secret: () => string; routes: () => string[] },
): Storage {
  const keyFor = (key: string) => hashRateLimitIdentity(options.secret(), "address", key);
  const routeFor = (key: string) => {
    const path = key.slice(key.lastIndexOf("|") + 1);
    return (
      options.routes().find((route) => {
        const template = route.split("/");
        const segments = path.split("/");
        return (
          template.length === segments.length &&
          template.every((segment, i) => segment.startsWith(":") || segment === segments[i])
        );
      }) ?? "auth:other"
    );
  };
  return {
    async get(key) {
      const counter = await readRateLimitCounter(database, keyFor(key), new Date());
      return counter && { key, count: counter.count, lastRequest: counter.lastRequest };
    },
    async set(key, value) {
      await writeRateLimitCounter(database, {
        key: keyFor(key),
        route: routeFor(key),
        count: value.count,
        lastRequest: value.lastRequest,
        expiresAt: new Date(value.lastRequest + 60_000),
      });
    },
    async consume(key, rule) {
      return consumeRateLimitCounter(database, {
        key: keyFor(key),
        route: routeFor(key),
        now: new Date(),
        window: rule.window,
        max: rule.max,
        sliding: true,
      });
    },
  };
}
