interface PendingNavigation {
  pathname: string;
  type: string;
  startedAt: number;
}

/**
 * Remembers the navigation the router has started, so the page it lands on can report how long
 * the click took to reach its content.
 */
class NavigationTiming {
  private pending: PendingNavigation | null = null;

  start(url: string, type: string): void {
    this.pending = {
      pathname: new URL(url, window.location.origin).pathname,
      type,
      startedAt: performance.now(),
    };
  }

  /** The navigation that landed on `pathname`, handed out once; one that went elsewhere is dropped. */
  take(pathname: string): PendingNavigation | null {
    const pending = this.pending;
    this.pending = null;
    return pending?.pathname === pathname ? pending : null;
  }
}

export const navigationTiming = new NavigationTiming();

const RECORD_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** A route's shape with record ids taken out, so visits to different records group together. */
export function routeShape(pathname: string): string {
  return pathname.replace(RECORD_ID, ":id");
}
