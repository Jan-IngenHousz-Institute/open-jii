import { navigationTiming } from "~/lib/navigation-timing";

export function onRouterTransitionStart(url: string, navigationType: string): void {
  navigationTiming.start(url, navigationType);
}
