"use client";

import { Check, ChevronDown } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// Position the indicator before the browser paints so it never animates in from
// the top-left on first mount; falls back to useEffect during SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// Shared count-badge styling (desktop tab + mobile menu row).
const countBadgeClass =
  "bg-muted text-muted-foreground group-data-[state=active]:bg-primary/20 group-data-[state=active]:text-primary inline-flex min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-semibold tabular-nums";

// Active value mirrored from Radix so the closed mobile dropdown can show its label.
const NavTabsValueContext = React.createContext<string | undefined>(undefined);

// Which skin a trigger renders: desktop underline tab vs. mobile menu row.
const NavTabsLayoutContext = React.createContext<"horizontal" | "menu">("horizontal");

// Wraps Radix Root to expose the active value via context (for the mobile
// dropdown), tracking both controlled and uncontrolled usage.
const NavTabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, children, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    value ?? defaultValue,
  );
  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback(
    (next: string) => {
      setInternalValue(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  return (
    <NavTabsValueContext.Provider value={currentValue}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </NavTabsValueContext.Provider>
  );
});
NavTabs.displayName = "NavTabs";

// Pull the visible label out of a trigger. With `asChild` the real child is a
// wrapper element (e.g. a Next.js `<Link>`), so the label lives one level in.
function getTriggerLabel(child: React.ReactElement): React.ReactNode {
  const props = child.props as { children?: React.ReactNode; asChild?: boolean };
  if (props.asChild && React.isValidElement(props.children)) {
    return (props.children.props as { children?: React.ReactNode }).children;
  }
  return props.children;
}

// Mobile list — tabs collapse into a popover. Real triggers render as menu rows
// (navigation/switching still works); the closed button shows the active label.
const NavTabsMobileList = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => {
  const currentValue = React.useContext(NavTabsValueContext);
  const [open, setOpen] = React.useState(false);

  const items = React.Children.toArray(children).filter(
    React.isValidElement,
  ) as React.ReactElement[];
  const active =
    items.find((child) => (child.props as { value?: string }).value === currentValue) ?? items[0];
  const activeCount = active ? (active.props as { count?: number }).count : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-border bg-background text-foreground hover:bg-muted/40 focus-visible:ring-ring data-[state=open]:border-primary/60 flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{active ? getTriggerLabel(active) : null}</span>
            {typeof activeCount === "number" ? (
              <span className={countBadgeClass}>{activeCount}</span>
            ) : null}
          </span>
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        <TabsPrimitive.List
          className="flex flex-col gap-0.5"
          {...props}
          // Close once a row is chosen (covers both mouse and keyboard activation).
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('[role="tab"]')) setOpen(false);
          }}
        >
          {children}
        </TabsPrimitive.List>
      </PopoverContent>
    </Popover>
  );
};
NavTabsMobileList.displayName = "NavTabsMobileList";

// Desktop list — horizontal tab row with a single indicator that slides under
// the active tab, sharing the 2px height of the baseline (`border-b-2`).
// `self-start` avoids stretch-align in flex-col parents.
const NavTabsDesktopList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const currentValue = React.useContext(NavTabsValueContext);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = React.useState<{ left: number; top: number; width: number } | null>(null);

  useIsomorphicLayoutEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;

    const measure = () => {
      const active = node.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      // 0-width means an unmeasured layout (SSR / jsdom) — keep the bar hidden.
      if (!active || active.offsetWidth === 0) {
        setRect(null);
        return;
      }
      setRect({
        left: active.offsetLeft,
        width: active.offsetWidth,
        top: active.offsetTop + active.offsetHeight,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentValue]);

  return (
    // Positioning context for the indicator.
    <div ref={wrapperRef} className="relative max-w-full self-start">
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "border-border inline-flex max-w-full flex-wrap items-end gap-6 border-b-2",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.List>
      {/* Mounted only once measured: a fresh element doesn't transition its initial
          style, so the bar appears in place on load but still animates between tabs. */}
      {rect ? (
        <span
          aria-hidden
          className="bg-primary pointer-events-none absolute left-0 top-0 h-0.5 rounded-full transition-[transform,width,top] duration-300 ease-out"
          style={{ transform: `translateX(${rect.left}px)`, width: rect.width, top: rect.top }}
        />
      ) : null}
    </div>
  );
});
NavTabsDesktopList.displayName = "NavTabsDesktopList";

// List — a horizontal underline tab row on desktop; collapses to a dropdown on
// mobile.
const NavTabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ children, ...props }, ref) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <NavTabsLayoutContext.Provider value="menu">
        <NavTabsMobileList {...props}>{children}</NavTabsMobileList>
      </NavTabsLayoutContext.Provider>
    );
  }

  return (
    <NavTabsLayoutContext.Provider value="horizontal">
      <NavTabsDesktopList ref={ref} {...props}>
        {children}
      </NavTabsDesktopList>
    </NavTabsLayoutContext.Provider>
  );
});
NavTabsList.displayName = "NavTabsList";

interface NavTabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  count?: number;
}

// Trigger — desktop underline tab or mobile menu row. The desktop underline is
// drawn by the list's sliding indicator, so the trigger only styles its text.
const NavTabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  NavTabsTriggerProps
>(({ className, children, count, asChild, ...props }, ref) => {
  const layout = React.useContext(NavTabsLayoutContext);

  if (layout === "menu") {
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        asChild={asChild}
        className={cn(
          "focus-visible:ring-ring group relative flex w-full select-none items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2",
          // active — brand teal text on a faint teal wash
          "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
          // inactive — muted text, hover surfaces a row background
          "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted data-[state=inactive]:hover:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {/* asChild merges onto a single element (e.g. a Link), so don't inject siblings. */}
        {asChild ? (
          children
        ) : (
          <>
            <span className="flex-1 truncate">{children}</span>
            {typeof count === "number" ? <span className={countBadgeClass}>{count}</span> : null}
            <Check className="text-primary h-4 w-4 shrink-0 opacity-0 group-data-[state=active]:opacity-100" />
          </>
        )}
      </TabsPrimitive.Trigger>
    );
  }

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      asChild={asChild}
      className={cn(
        "focus-visible:ring-ring group relative inline-flex shrink-0 select-none items-center gap-2 whitespace-nowrap px-1 pb-3 pt-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2",

        // active — brand teal text (the sliding indicator draws the underline)
        "data-[state=active]:text-primary",

        // inactive — muted text, hover only darkens the text (no underline preview)
        "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",

        // disabled
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : typeof count === "number" ? (
        <>
          <span>{children}</span>
          <span className={countBadgeClass}>{count}</span>
        </>
      ) : (
        children
      )}
    </TabsPrimitive.Trigger>
  );
});
NavTabsTrigger.displayName = "NavTabsTrigger";

const NavTabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-3", className)} {...props} />
));
NavTabsContent.displayName = "NavTabsContent";

export { NavTabs, NavTabsList, NavTabsTrigger, NavTabsContent };
