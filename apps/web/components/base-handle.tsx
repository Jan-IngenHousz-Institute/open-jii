import { Handle } from "@xyflow/react";
import type { HandleProps } from "@xyflow/react";
import { forwardRef } from "react";

import { cn } from "@repo/ui/lib/utils";

export type BaseHandleProps = HandleProps;

export interface ExtendedBaseHandleProps extends HandleProps {
  selected?: boolean;
  dragging?: boolean;
  colorClass?: string;
}

export const BaseHandle: ReturnType<typeof forwardRef<HTMLDivElement, ExtendedBaseHandleProps>> =
  forwardRef<HTMLDivElement, ExtendedBaseHandleProps>(
    ({ className, children, selected, dragging, colorClass, ...props }, ref) => {
      return (
        <Handle
          ref={ref}
          {...props}
          className={cn(
            "!h-[12px] !w-[12px] rounded-full border opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
            colorClass,
            (selected ?? dragging) && "opacity-100",
            className,
          )}
        >
          {children}
        </Handle>
      );
    },
  );

BaseHandle.displayName = "BaseHandle";
