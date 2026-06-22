"use client";

import type { ReactNode } from "react";

export interface ScaledFrameProps {
  innerHeight: number;
  scale: number;
  hidden?: boolean;
  width: number;
  children: ReactNode;
}

export function ScaledFrame({ innerHeight, scale, hidden, width, children }: ScaledFrameProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 origin-top-left [&_.modebar-container]:hidden"
      style={{
        width,
        height: innerHeight,
        transform: `scale(${scale})`,
        visibility: hidden ? "hidden" : "visible",
      }}
    >
      {children}
    </div>
  );
}
