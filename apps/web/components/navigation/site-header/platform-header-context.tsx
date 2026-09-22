"use client";

import * as React from "react";

export interface PlatformHeaderBreadcrumb {
  href: string;
  label: string;
}

interface PlatformHeaderContextValue {
  detailBreadcrumb: PlatformHeaderBreadcrumb | null;
  registerDetailBreadcrumb: (
    owner: symbol,
    breadcrumb: PlatformHeaderBreadcrumb | null,
  ) => () => void;
}

const PlatformHeaderContext = React.createContext<PlatformHeaderContextValue | null>(null);

/**
 * Lets the route layout that already owns an entity query contribute its real
 * title to the shell header without adding a second fetch in SiteHeader.
 */
export function PlatformHeaderProvider({ children }: { children: React.ReactNode }) {
  const [detailBreadcrumb, setDetailBreadcrumb] = React.useState<PlatformHeaderBreadcrumb | null>(
    null,
  );
  const activeOwner = React.useRef<symbol | null>(null);

  const registerDetailBreadcrumb = React.useCallback(
    (owner: symbol, breadcrumb: PlatformHeaderBreadcrumb | null) => {
      activeOwner.current = owner;
      setDetailBreadcrumb(breadcrumb);

      return () => {
        if (activeOwner.current !== owner) return;
        activeOwner.current = null;
        setDetailBreadcrumb(null);
      };
    },
    [],
  );

  const value = React.useMemo(
    () => ({ detailBreadcrumb, registerDetailBreadcrumb }),
    [detailBreadcrumb, registerDetailBreadcrumb],
  );

  return <PlatformHeaderContext.Provider value={value}>{children}</PlatformHeaderContext.Provider>;
}

export function PlatformHeaderDetail({ href, label }: PlatformHeaderBreadcrumb) {
  const context = React.useContext(PlatformHeaderContext);
  const registerDetailBreadcrumb = context?.registerDetailBreadcrumb;
  const [owner] = React.useState(() => Symbol("platform-header-detail"));

  React.useEffect(() => {
    if (!registerDetailBreadcrumb) return;
    return registerDetailBreadcrumb(owner, { href, label });
  }, [href, label, owner, registerDetailBreadcrumb]);

  return null;
}

export function usePlatformHeaderDetail() {
  return React.useContext(PlatformHeaderContext)?.detailBreadcrumb ?? null;
}
