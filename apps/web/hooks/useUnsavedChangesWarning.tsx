"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useCallback, useState } from "react";

interface UseUnsavedChangesWarningProps {
  hasUnsavedChanges: boolean;
  message?: string;
}

/**
 * Hook to warn users about unsaved changes when they try to leave the page
 * Handles both browser navigation (refresh/close) and Next.js navigation
 * Returns state for controlling a custom dialog component
 */
export function useUnsavedChangesWarning({
  hasUnsavedChanges,
  message = "You have unsaved changes. Are you sure you want to leave?",
}: UseUnsavedChangesWarningProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isNavigatingRef = useRef(false);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const messageRef = useRef(message);
  const pendingNavigationRef = useRef<string | null>(null);

  // State for custom dialog
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMessage, setDialogMessage] = useState(message);

  // Keep refs up to date
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    messageRef.current = message;
  }, [hasUnsavedChanges, message]);

  // Handle browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isNavigatingRef.current) {
        e.preventDefault();
        e.returnValue = ""; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle internal Next.js navigation by intercepting link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only intercept if we have unsaved changes and not already navigating
      if (!hasUnsavedChangesRef.current || isNavigatingRef.current) {
        return;
      }

      // closest() to find the nearest anchor element
      const anchor = (e.target as HTMLElement).closest("a");

      if (!anchor?.href) {
        return;
      }

      // Check if it's an internal navigation (same origin)
      const url = new URL(anchor.href);
      const currentUrl = new URL(window.location.href);

      if (url.origin !== currentUrl.origin) {
        // External link, let beforeunload handle it
        return;
      }

      // Check if it's navigating to a different page
      if (url.pathname === pathname) {
        // Same page, allow it
        return;
      }

      // Check if it's a download link or has target="_blank"
      if (anchor.download || anchor.target === "_blank") {
        return;
      }

      // Prevent the navigation and show custom dialog
      e.preventDefault();
      e.stopPropagation();

      const href = anchor.getAttribute("href");
      pendingNavigationRef.current = href?.startsWith("/") ? href : anchor.href;
      setDialogMessage(messageRef.current);
      setShowDialog(true);
    };

    // Capture phase to intercept before Next.js Link component
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname]);

  const handleConfirmNavigation = useCallback(() => {
    setShowDialog(false);
    isNavigatingRef.current = true;

    if (pendingNavigationRef.current) {
      const href = pendingNavigationRef.current;
      pendingNavigationRef.current = null;

      if (href.startsWith("/")) {
        router.push(href);
      } else {
        // For external URLs, trigger navigation via effect
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.click();
      }
    }
  }, [router]);

  const handleCancelNavigation = useCallback(() => {
    setShowDialog(false);
    pendingNavigationRef.current = null;
  }, []);

  // Wrapper for router.push that shows confirmation dialog
  const safePush = useCallback(
    (href: string) => {
      if (hasUnsavedChanges && !isNavigatingRef.current) {
        pendingNavigationRef.current = href;
        setDialogMessage(message);
        setShowDialog(true);
      } else {
        router.push(href);
      }
    },
    [hasUnsavedChanges, message, router],
  );

  return {
    safePush,
    showDialog,
    dialogMessage,
    handleConfirmNavigation,
    handleCancelNavigation,
  };
}
