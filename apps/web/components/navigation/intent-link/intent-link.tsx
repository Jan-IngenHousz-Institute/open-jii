"use client";

import Link from "next/link";
import type { ComponentProps, FocusEvent, MouseEvent, TouchEvent } from "react";
import { useState } from "react";

type IntentLinkProps = Omit<ComponentProps<typeof Link>, "prefetch"> & {
  /**
   * Keeps Next's prefetch of the page's loading shell while the link is on screen, so a click
   * shows the new page at once. Meant for the few links people use most, such as the sidebar and
   * tabs, not for every row of a table.
   */
  prefetchWhileVisible?: boolean;
};

/**
 * Prefetches the whole page, data included, once the pointer rests on the link, a touch starts or
 * it takes keyboard focus. Until then it prefetches nothing, unless `prefetchWhileVisible` asks for
 * the loading shell: a table of these would otherwise render every linked page on the server just
 * for being on screen.
 */
export function IntentLink({
  prefetchWhileVisible = false,
  onMouseEnter,
  onTouchStart,
  onFocus,
  ...props
}: IntentLinkProps) {
  const [hasIntent, setHasIntent] = useState(false);
  const visiblePrefetch = prefetchWhileVisible ? null : false;

  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    setHasIntent(true);
    onMouseEnter?.(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    setHasIntent(true);
    onTouchStart?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLAnchorElement>) {
    setHasIntent(true);
    onFocus?.(event);
  }

  return (
    <Link
      {...props}
      prefetch={hasIntent ? true : visiblePrefetch}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      onFocus={handleFocus}
    />
  );
}
