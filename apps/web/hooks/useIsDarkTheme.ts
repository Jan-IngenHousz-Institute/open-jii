"use client";

import { useEffect, useState } from "react";

/**
 * Whether the app is currently rendering dark.
 *
 * Reads the `dark` class off `<html>` rather than `next-themes`'
 * `resolvedTheme`, deliberately. `resolvedTheme` is `undefined` until the
 * provider mounts, so a consumer that branches on it renders light for one
 * frame and then flips — visible as a flash. next-themes sets the class from a
 * blocking script before React hydrates, so the class is already correct on the
 * very first paint. The observer then keeps it in step with the toggle, and
 * with the OS when the theme is `system`, because next-themes maintains the
 * class in both cases.
 *
 * Only for consumers that cannot express themselves in CSS. Anything that can
 * use a `dark:` variant or a theme token should do that instead — this is for
 * third-party surfaces (CodeMirror, Plotly) that paint from a JS palette.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setIsDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
