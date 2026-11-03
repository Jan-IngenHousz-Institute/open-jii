"use client";

import { Leaf } from "lucide-react";
import { useRef } from "react";
import { useDarkAdaptedFlash } from "~/hooks/use-dark-adapted-flash";

import { IntakeBubbles } from "./intake-bubbles";

export function IntakeLeaf({ messagesPerMinute }: { messagesPerMinute: number | undefined }) {
  const leaf = useRef<SVGSVGElement>(null);
  useDarkAdaptedFlash(leaf);

  return (
    <span className="relative inline-flex">
      <Leaf ref={leaf} className="text-status-active-foreground size-4" aria-hidden />
      <IntakeBubbles messagesPerMinute={messagesPerMinute} />
    </span>
  );
}
