"use client";

import { useEffect, useState } from "react";

/**
 * Re-render the calling chart when the effective theme flips.
 *
 * Chart palettes are resolved from CSS custom properties (`--chart-1..5`,
 * `--foreground`, `--border`, ...) at render time because Plotly cannot
 * read a CSS variable. Nothing in React observes the `dark` class that
 * next-themes toggles on `<html>`, so without this subscription a rendered
 * chart keeps the old palette until something else re-renders it. The
 * observer fires after the class mutation, so `getComputedStyle` already
 * reflects the new theme when the re-render resolves colours.
 *
 * Called inside `useChartSizing`, which every chart component already uses;
 * components that resolve theme colours without sizing (LollipopChart) call
 * it directly.
 */
export function useChartThemeRefresh(): void {
  const [, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setIsDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
}
