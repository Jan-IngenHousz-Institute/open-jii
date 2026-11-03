"use client";

import * as React from "react";

import { PopoverContent } from "../popover";
import { focusCommandRoot } from "./focus-command-root";
import { ValueList } from "./value-list";

interface ValueListContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof PopoverContent>, "onOpenAutoFocus">,
    Pick<React.ComponentProps<typeof ValueList>, "filter" | "onLeave"> {}

/** A filter's values as a checkbox list in a popover. */
export function ValueListContent({ filter, onLeave, ...props }: ValueListContentProps) {
  const commandRef = React.useRef<HTMLDivElement>(null);

  return (
    <PopoverContent
      className="w-[220px] p-0"
      {...props}
      onOpenAutoFocus={focusCommandRoot(commandRef)}
    >
      <ValueList filter={filter} commandRef={commandRef} onLeave={onLeave} />
    </PopoverContent>
  );
}
