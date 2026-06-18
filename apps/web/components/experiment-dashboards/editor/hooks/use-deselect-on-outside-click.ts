"use client";

import { useEffect, useRef } from "react";

import type { DashboardTool } from "../context/dashboard-editor-context";

interface UseDeselectOnOutsideClickParams {
  tool: DashboardTool;
  selectedWidgetId: string | null;
  selectWidget: (id: string | null) => void;
  setTool: (tool: DashboardTool) => void;
}

// Refs because the listeners attach once and must read live state without
// re-binding on every selection/tool flip.
export function useDeselectOnOutsideClick({
  tool,
  selectedWidgetId,
  selectWidget,
  setTool,
}: UseDeselectOnOutsideClickParams) {
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const selectedWidgetIdRef = useRef(selectedWidgetId);
  selectedWidgetIdRef.current = selectedWidgetId;
  const selectWidgetRef = useRef(selectWidget);
  selectWidgetRef.current = selectWidget;
  const setToolRef = useRef(setTool);
  setToolRef.current = setTool;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // Don't deselect during placement mode; the click drops a widget.
      if (toolRef.current !== "cursor") {
        return;
      }
      if (selectedWidgetIdRef.current === null) {
        return;
      }
      const target = e.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      if (target.closest("[data-dashboard-widget]")) {
        return;
      }
      if (target.closest("[data-editor-chrome]")) {
        return;
      }
      // Radix portals render outside the widget tree.
      if (target.closest("[data-radix-popper-content-wrapper]")) {
        return;
      }
      selectWidgetRef.current(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      // Esc cancels placement, then deselects.
      if (toolRef.current !== "cursor") {
        setToolRef.current("cursor");
        return;
      }
      if (selectedWidgetIdRef.current !== null) {
        selectWidgetRef.current(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
