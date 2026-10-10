import type { PostHog } from "posthog-js";

let loading: Promise<PostHog> | undefined;

/**
 * posthog-js is about 80 KB gzipped, so it is fetched once the page is interactive rather than
 * before. Every caller shares the one download and the one client.
 */
export function loadPostHog(): Promise<PostHog> {
  loading ??= import("posthog-js").then((module) => module.default);
  return loading;
}
