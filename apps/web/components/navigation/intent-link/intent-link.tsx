"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent, TouchEvent } from "react";
import { useState } from "react";

type IntentLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * A dynamic route's link prefetches only its loading shell. This one prefetches the whole page,
 * data included, once the pointer rests on it or a touch starts, so the page is usually in the
 * router cache by the click.
 */
export function IntentLink({ onMouseEnter, onTouchStart, ...props }: IntentLinkProps) {
  const [hasIntent, setHasIntent] = useState(false);

  function handleMouseEnter(event: MouseEvent<HTMLAnchorElement>) {
    setHasIntent(true);
    onMouseEnter?.(event);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    setHasIntent(true);
    onTouchStart?.(event);
  }

  return (
    <Link
      {...props}
      prefetch={hasIntent ? true : null}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
    />
  );
}
