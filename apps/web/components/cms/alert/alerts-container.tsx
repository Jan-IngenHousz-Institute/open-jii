"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { severityRank } from "@repo/cms/alert";
import type { ComponentAlertFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { AlertBanner } from "./alert-banner";

interface AlertsContainerProps {
  alerts: ComponentAlertFieldsFragment[];
}

const subscribeNever = () => () => undefined;

export const AlertsContainer: React.FC<AlertsContainerProps> = ({ alerts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const handleDismiss = (key: string) => {
    localStorage.setItem(`alert-dismissed-${key}`, "true");
    setDismissed((prev) => new Set([...prev, key]));
  };

  const visible = alerts
    .filter((a) => {
      if (!hydrated) return false;
      const key = a.internalName ?? a.sys.id;
      return !dismissed.has(key) && localStorage.getItem(`alert-dismissed-${key}`) !== "true";
    })
    .sort((a, b) => severityRank(a) - severityRank(b));

  useEffect(() => {
    const el = containerRef.current;
    if (!el || visible.length === 0) {
      document.documentElement.style.removeProperty("--banner-offset");
      return;
    }
    const update = () =>
      document.documentElement.style.setProperty("--banner-offset", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible.length]);

  if (visible.length === 0) return null;

  return (
    <div ref={containerRef} className="bg-background sticky top-0 z-40">
      {visible.map((alert) => (
        <AlertBanner
          key={alert.sys.id}
          alert={alert}
          onDismiss={() => handleDismiss(alert.internalName ?? alert.sys.id)}
        />
      ))}
    </div>
  );
};
