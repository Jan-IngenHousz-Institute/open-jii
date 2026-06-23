"use client";

import { ViewVerticalIcon } from "@radix-ui/react-icons";
import { VariantProps, cva } from "class-variance-authority";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { Slot as SlotPrimitive } from "radix-ui";
import * as React from "react";

import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
import { Separator } from "./separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./sheet";
import { Skeleton } from "./skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

const SIDEBAR_STORAGE_KEY = "openjii.sidebar";

function getModKey(): string {
  if (typeof window === "undefined") return "⌘";
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform) ||
    /Macintosh/.test(window.navigator.userAgent)
    ? "⌘"
    : "Ctrl";
}
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH_DEFAULT = 264;
const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_MAX = 360;
const SIDEBAR_COLLAPSE_THRESHOLD = 180;
const SIDEBAR_WIDTH_KEYBOARD_STEP = 8;
const SIDEBAR_WIDTH_TABLET = "14rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "4.5rem";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  width: number;
  setWidth: (width: number) => void;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  /**
   * `peeking` is true while the user is hovering the left edge of the
   * viewport with the sidebar collapsed. The sidebar slides in as an overlay
   * (no layout shift) and slides back out when the mouse leaves it.
   */
  peeking: boolean;
  setPeeking: (peeking: boolean) => void;
};

type StoredSidebarState = { width?: number; collapsed?: boolean };

function clampWidth(width: number) {
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, width));
}

function readStoredSidebar(): StoredSidebarState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSidebarState;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSidebar(next: StoredSidebarState) {
  if (typeof window === "undefined") return;
  try {
    const existing = readStoredSidebar() ?? {};
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify({ ...existing, ...next }));
  } catch {
    /* localStorage might be unavailable in private mode — ignore */
  }
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    const [width, _setWidth] = React.useState(SIDEBAR_WIDTH_DEFAULT);
    const [dragging, setDragging] = React.useState(false);
    const [peeking, setPeeking] = React.useState(false);

    // Hydrate width + collapsed from localStorage on mount (client only).
    React.useEffect(() => {
      const stored = readStoredSidebar();
      if (!stored) return;
      if (typeof stored.width === "number") {
        _setWidth(clampWidth(stored.width));
      }
      if (typeof stored.collapsed === "boolean") {
        if (setOpenProp) {
          setOpenProp(!stored.collapsed);
        } else {
          _setOpen(!stored.collapsed);
        }
      }
    }, [setOpenProp]);

    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }
        writeStoredSidebar({ collapsed: !openState });
        // Mirror to the cookie for back-compat with any SSR readers; cheap.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open],
    );

    const setWidth = React.useCallback((next: number) => {
      _setWidth(clampWidth(next));
    }, []);

    // Persist width on pointer-up only (not on every move).
    React.useEffect(() => {
      if (dragging) return;
      writeStoredSidebar({ width });
    }, [dragging, width]);

    // Helper to toggle the sidebar. The ⌘/Ctrl+B shortcut that drives this is
    // registered in the app's ShortcutsRoot (TanStack Hotkeys), not here.
    const toggleSidebar = React.useCallback(() => {
      return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed";

    // Clear peek whenever the sidebar opens for real or we hit mobile, so
    // state doesn't get stuck.
    React.useEffect(() => {
      if (open || isMobile) setPeeking(false);
    }, [open, isMobile]);

    const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        width,
        setWidth,
        dragging,
        setDragging,
        peeking,
        setPeeking,
      }),
      [
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        width,
        setWidth,
        dragging,
        peeking,
      ],
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": `${width}px`,
                "--sidebar-width-tablet": SIDEBAR_WIDTH_TABLET,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper has-[[data-variant=inset]]:bg-sidebar flex min-h-svh w-full",
              dragging && "select-none",
              className,
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none" | "hidden";
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const { isMobile, state, openMobile, setOpenMobile, dragging, peeking, setPeeking } =
      useSidebar();

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "bg-sidebar text-sidebar-foreground w-(--sidebar-width) flex h-full flex-col",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      );
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Sidebar</SheetTitle>
              <SheetDescription>Displays the mobile sidebar.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      );
    }

    // When the sidebar is collapsed in `hidden` mode but the user is hovering
    // the edge peek strip, slide it in as an overlay (no layout shift). This
    // matches Linear's "hover the edge to peek" pattern.
    const isPeeking = peeking && collapsible === "hidden" && state === "collapsed";

    return (
      <div
        ref={ref}
        className="text-sidebar-foreground group peer hidden md:block"
        data-state={state}
        data-collapsible={state === "collapsed" ? collapsible : ""}
        data-variant={variant}
        data-side={side}
        data-dragging={dragging || undefined}
        data-peeking={isPeeking || undefined}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "w-(--sidebar-width) md:w-(--sidebar-width-tablet) lg:w-(--sidebar-width) relative bg-transparent transition-[width] duration-200 ease-linear",
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[collapsible=hidden]:w-0",
            "group-data-[side=right]:rotate-180",
            "group-data-[dragging=true]:transition-none",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          )}
        />
        <div
          onMouseLeave={() => {
            if (isPeeking) setPeeking(false);
          }}
          className={cn(
            "w-(--sidebar-width) md:w-(--sidebar-width-tablet) lg:w-(--sidebar-width) fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] duration-200 ease-linear md:flex",
            "group-data-[dragging=true]:transition-none",
            side === "left"
              ? "left-0 group-data-[collapsible=hidden]:left-[calc(var(--sidebar-width)*-1)] group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=hidden]:right-[calc(var(--sidebar-width)*-1)] group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            // Peek state: slide back to flush-left, raise z-index above the
            // topbar (z-40) and other chrome so it overlays without pushing
            // the page.
            "group-data-[peeking=true]:!left-0 group-data-[peeking=true]:!right-auto group-data-[peeking=true]:z-50 group-data-[peeking=true]:shadow-xl",
            // Keep z-50 through the slide-out too (peeking flips off instantly,
            // but `left` animates 200ms); parked off-screen, so it's harmless.
            "group-data-[collapsible=hidden]:z-50",
            // Adjust the padding for floating and inset variants.
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className,
          )}
          {...props}
          style={{
            top: "var(--banner-offset, 0px)",
            height: "calc(100svh - var(--banner-offset, 0px))",
          }}
        >
          <div
            data-sidebar="sidebar"
            className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, state } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("!h-8 !w-8 [&_svg]:group-hover:text-white", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {state === "collapsed" ? (
        <PanelLeftOpen className="text-primary !h-6 !w-6" />
      ) : (
        <PanelLeftClose className="!h-6 !w-6" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

type SidebarRailProps = React.ComponentProps<"div"> & {
  /** Enable pointer-drag resize. Off by default for backwards compat. */
  resizable?: boolean;
};

const SidebarRail = React.forwardRef<HTMLDivElement, SidebarRailProps>(
  ({ className, resizable = false, onDoubleClick, ...props }, ref) => {
    const { toggleSidebar, width, setWidth, setOpen, open, setDragging } = useSidebar();
    const dragStateRef = React.useRef<{
      startX: number;
      startWidth: number;
      moved: boolean;
      dir: number;
    } | null>(null);

    const handlePointerDown = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (!resizable) return;
        if (event.button !== 0) return;
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        dragStateRef.current = {
          startX: event.clientX,
          startWidth: width,
          moved: false,
          // On a right-side sidebar the handle is on the left edge, so dragging
          // right shrinks it — invert the delta.
          dir: target.closest("[data-side]")?.getAttribute("data-side") === "right" ? -1 : 1,
        };
        setDragging(true);
        event.preventDefault();
      },
      [resizable, width, setDragging],
    );

    const handlePointerMove = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state) return;
        const delta = (event.clientX - state.startX) * state.dir;
        if (Math.abs(delta) > 2) state.moved = true;
        const next = state.startWidth + delta;
        if (next < SIDEBAR_COLLAPSE_THRESHOLD) {
          // Snap to collapsed and end the drag.
          dragStateRef.current = null;
          setDragging(false);
          event.currentTarget.releasePointerCapture(event.pointerId);
          setOpen(false);
          return;
        }
        setWidth(next);
      },
      [setOpen, setWidth, setDragging],
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        dragStateRef.current = null;
        setDragging(false);
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* may already be released */
        }
        // If pointer-down without meaningful movement, treat as a click → toggle.
        if (state && !state.moved && !resizable) {
          toggleSidebar();
        }
      },
      [resizable, toggleSidebar, setDragging],
    );

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!resizable) return;
        const dir =
          event.currentTarget.closest("[data-side]")?.getAttribute("data-side") === "right"
            ? -1
            : 1;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setWidth(width - SIDEBAR_WIDTH_KEYBOARD_STEP * dir);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          setWidth(width + SIDEBAR_WIDTH_KEYBOARD_STEP * dir);
        } else if (event.key === "Home") {
          event.preventDefault();
          setWidth(SIDEBAR_WIDTH_MIN);
        } else if (event.key === "End") {
          event.preventDefault();
          setWidth(SIDEBAR_WIDTH_MAX);
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleSidebar();
        }
      },
      [resizable, width, setWidth, toggleSidebar],
    );

    return (
      <div
        ref={ref}
        data-sidebar="rail"
        role={resizable ? "separator" : "button"}
        aria-orientation={resizable ? "vertical" : undefined}
        aria-valuenow={resizable ? width : undefined}
        aria-valuemin={resizable ? SIDEBAR_WIDTH_MIN : undefined}
        aria-valuemax={resizable ? SIDEBAR_WIDTH_MAX : undefined}
        aria-label={resizable ? "Resize sidebar" : "Toggle Sidebar"}
        aria-expanded={!resizable ? open : undefined}
        tabIndex={0}
        title={resizable ? "Drag to resize, double-click to toggle" : "Toggle Sidebar"}
        onClick={!resizable ? toggleSidebar : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={(event) => {
          onDoubleClick?.(event);
          toggleSidebar();
        }}
        onKeyDown={(event) => {
          if (!resizable && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            toggleSidebar();
            return;
          }
          handleKeyDown(event);
        }}
        className={cn(
          "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
          "[[data-side=left]_&]:cursor-w-resize [[data-side=right]_&]:cursor-e-resize",
          "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
          "group-data-[collapsible=offcanvas]:hover:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
          "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
          "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
          // Resizable rail: brand-tinted indicator on hover/drag, hit area is 7px-wide.
          resizable && [
            "[--rail-color:color-mix(in_srgb,var(--primary)_60%,transparent)]",
            "w-[7px] -translate-x-[2px]",
            "after:bg-(--rail-color) after:opacity-0 after:transition-opacity after:duration-[120ms]",
            "hover:after:opacity-100 focus-visible:after:opacity-100 group-data-[dragging=true]:after:opacity-100",
            "[[data-side=left]_&]:cursor-col-resize [[data-side=right]_&]:cursor-col-resize",
          ],
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarRail.displayName = "SidebarRail";

/**
 * Floating reopen affordance shown when the sidebar is collapsed in "hidden" mode.
 * Mount once at the layout level alongside `<Sidebar collapsible="hidden" />`.
 * Hidden while the user is peeking (the sidebar itself is already visible).
 */
const SidebarFloatingReopen = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar, open, isMobile, peeking } = useSidebar();
    if (open || isMobile || peeking) return null;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label="Open sidebar"
            aria-expanded={false}
            onClick={(event) => {
              onClick?.(event);
              toggleSidebar();
            }}
            className={cn(
              "text-foreground/70 hover:bg-foreground/5 hover:text-foreground focus-visible:ring-ring focus-visible:outline-hidden fixed left-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-opacity focus-visible:ring-2",
              className,
            )}
            {...props}
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Show sidebar ({getModKey()} B)</TooltipContent>
      </Tooltip>
    );
  },
);
SidebarFloatingReopen.displayName = "SidebarFloatingReopen";

/**
 * Invisible left-edge strip that triggers a sidebar "peek" on hover when the
 * sidebar is collapsed. Renders nothing when the sidebar is open, on mobile,
 * or in any collapsible mode other than `hidden`.
 */
const SidebarEdgePeek = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    const { open, isMobile, peeking, setPeeking } = useSidebar();
    if (open || isMobile) return null;

    return (
      <div
        ref={ref}
        aria-hidden="true"
        onMouseEnter={() => setPeeking(true)}
        data-peeking={peeking || undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-2",
          // The strip itself is invisible; only its hover triggers the peek.
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarEdgePeek.displayName = "SidebarEdgePeek";

const SidebarInset = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-background relative flex w-full min-w-0 flex-1 flex-col",
          "md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarInset.displayName = "SidebarInset";

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "bg-background focus-visible:ring-sidebar-ring h-8 w-full shadow-none focus-visible:ring-2",
        className,
      )}
      {...props}
    />
  );
});
SidebarInput.displayName = "SidebarInput";

const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} data-sidebar="header" className={cn("py-2", className)} {...props}>
        <div className="flex w-full cursor-default items-center gap-2 p-4 text-left text-sm">
          {children}
        </div>
      </div>
    );
  },
);
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="footer"
        className={cn("flex flex-col gap-2 py-2", className)}
        {...props}
      />
    );
  },
);
SidebarFooter.displayName = "SidebarFooter";

const SidebarSeparator: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<React.ComponentProps<typeof Separator>> &
    React.RefAttributes<React.ElementRef<typeof Separator>>
> = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
});
SidebarSeparator.displayName = "SidebarSeparator";

const SidebarContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="content"
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden",
          className,
        )}
        {...props}
      />
    );
  },
);
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-sidebar="group"
        className={cn("relative flex w-full min-w-0 flex-col py-2", className)}
        {...props}
      />
    );
  },
);
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? SlotPrimitive.Slot : "div";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring outline-hidden flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground outline-hidden absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupAction.displayName = "SidebarGroupAction";

const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  ),
);
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu"
      className={cn(
        "flex w-full min-w-0 flex-col gap-1 px-4 group-data-[collapsible=icon]:px-0",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  ),
);
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-3 overflow-hidden rounded-md px-6 py-3 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-white/10 hover:text-white hover:rounded-md hover:px-6 hover:py-3 focus-visible:ring-2 active:bg-white/10 active:text-white disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-white/10 data-[active=true]:font-normal data-[active=true]:text-white data-[state=open]:hover:bg-white/10 data-[state=open]:hover:text-white group-data-[collapsible=icon]:rounded-none group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:hover:px-0 [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-white/10 hover:text-white",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-white/10 hover:text-white hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-12 text-base",
        sm: "h-10 text-sm",
        lg: "h-14 text-base group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? SlotPrimitive.Slot : "button";
    const { isMobile, state } = useSidebar();

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    );

    if (!tooltip) {
      return button;
    }

    if (typeof tooltip === "string") {
      tooltip = {
        children: tooltip,
      };
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          hidden={state !== "collapsed" || isMobile}
          {...tooltip}
        />
      </Tooltip>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean;
    showOnHover?: boolean;
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? SlotPrimitive.Slot : "button";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground outline-hidden absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuAction.displayName = "SidebarMenuAction";

const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-sidebar="menu-badge"
      className={cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuBadge.displayName = "SidebarMenuBadge";

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean;
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
      {...props}
    >
      {showIcon && <Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        className="max-w-(--skeleton-width) h-4 flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
});
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton";

const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-sidebar="menu-sub"
      className={cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  ),
);
SidebarMenuSub.displayName = "SidebarMenuSub";

const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(
  ({ ...props }, ref) => <li ref={ref} {...props} />,
);
SidebarMenuSubItem.displayName = "SidebarMenuSubItem";

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean;
    size?: "sm" | "md";
    isActive?: boolean;
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? SlotPrimitive.Slot : "a";

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground outline-hidden flex h-9 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-4 hover:rounded-none hover:px-4 hover:py-2 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

export {
  Sidebar,
  SidebarContent,
  SidebarEdgePeek,
  SidebarFloatingReopen,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
