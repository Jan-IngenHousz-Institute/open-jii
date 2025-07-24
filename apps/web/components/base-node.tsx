import React, { forwardRef } from "react";
import type { HTMLAttributes, ReactNode, ForwardedRef } from "react";

import { cn } from "@repo/ui/lib/utils";

export interface BaseNodeProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  dragging?: boolean;
  onDelete?: (e: React.MouseEvent) => void;
  children?: ReactNode;
  nodeType?: string;
  borderColor?: string;
}

export const BaseNode = forwardRef<HTMLDivElement, BaseNodeProps>(function BaseNode(
  {
    className,
    selected,
    dragging,
    onDelete,
    children,
    borderColor,
    nodeType: _nodeType,
    ...props
  }: BaseNodeProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "group relative inline-block min-h-[60px] min-w-[120px] bg-transparent p-0",
        className,
      )}
      tabIndex={0}
      {...props}
    >
      <button
        className={cn(
          "pointer-events-auto absolute right-1 top-1 z-20 h-5 w-5 cursor-pointer rounded-full p-0 text-center text-xs leading-[18px] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
          (selected ?? dragging) && "opacity-100",
        )}
        title="Delete node"
        onClick={onDelete}
        aria-label="Delete node"
      >
        <span className="text-[18px] font-bold leading-[18px]">×</span>
      </button>
      <div className="node-hover-area absolute inset-0 z-[9] rounded-xl" />
      <div
        className={cn(
          "bg-card text-card-foreground relative rounded-xl border-2 bg-gray-50 shadow-lg",
          selected || dragging
            ? "!border-jii-dark-green !bg-jii-dark-green/10 shadow-lg"
            : borderColor,
        )}
      >
        {children}
      </div>
    </div>
  );
});
BaseNode.displayName = "BaseNode";

/**
 * A container for a consistent header layout intended to be used inside the
 * `<BaseNode />` component.
 */
export const BaseNodeHeader = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      {...props}
      className={cn(
        "mx-0 my-0 -mb-1 mt-2 flex flex-row items-center justify-between gap-2 px-3 py-2",
        // Remove or modify these classes if you modify the padding in the
        // `<BaseNode />` component.
        className,
      )}
    />
  ),
);
BaseNodeHeader.displayName = "BaseNodeHeader";

/**
 * The title text for the node. To maintain a native application feel, the title
 * text is not selectable.
 */
export const BaseNodeHeaderTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="base-node-title"
    className={cn("user-select-none flex-1 font-semibold", className)}
    {...props}
  />
));
BaseNodeHeaderTitle.displayName = "BaseNodeHeaderTitle";

export const BaseNodeContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3", className)}
      {...props}
    />
  ),
);
BaseNodeContent.displayName = "BaseNodeContent";

export const BaseNodeFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="base-node-footer"
      className={cn("flex flex-col items-center gap-y-2 border-t px-3 pb-3 pt-2", className)}
      {...props}
    />
  ),
);
BaseNodeFooter.displayName = "BaseNodeFooter";
