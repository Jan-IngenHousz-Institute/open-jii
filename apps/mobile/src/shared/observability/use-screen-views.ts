import { useSegments } from "expo-router";
import type PostHog from "posthog-react-native";
import { useEffect } from "react";

// The route pattern rather than the path, so one screen is one name however many ids it shows;
// "(tabs)" and other groups are layout, not part of what the researcher sees.
export function screenNameOf(segments: readonly string[]): string {
  return `/${segments.filter((segment) => !segment.startsWith("(")).join("/")}`;
}

/** Records a screen view each time the route pattern changes. */
export function useScreenViews(posthog: Pick<PostHog, "screen"> | undefined): void {
  const name = screenNameOf(useSegments());

  useEffect(() => {
    if (!posthog) {
      return;
    }
    void posthog.screen(name);
  }, [posthog, name]);
}
