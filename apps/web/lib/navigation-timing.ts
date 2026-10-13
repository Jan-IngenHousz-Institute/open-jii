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
  private loadingScreens = 0;
  private loadingChangedAt = 0;

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

  /** Counts a page loading screen as on screen until the returned release is called. */
  holdLoadingScreen(): () => void {
    this.loadingScreens += 1;
    this.loadingChangedAt = performance.now();

    return () => {
      this.loadingScreens -= 1;
      this.loadingChangedAt = performance.now();
    };
  }

  get isLoadingScreenShown(): boolean {
    return this.loadingScreens > 0;
  }

  /** When a loading screen last appeared or gave way to the content. */
  get lastLoadingChangeAt(): number {
    return this.loadingChangedAt;
  }
}

export const navigationTiming = new NavigationTiming();

const RECORD_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** A route's shape with record ids taken out, so visits to different records group together. */
export function routeShape(pathname: string): string {
  return pathname.replace(RECORD_ID, ":id");
}
