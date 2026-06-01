"use client";

import React, { useEffect, useRef, useState } from "react";

import type { ComponentAlertFieldsFragment } from "../../lib/__generated/sdk";
import { AlertBanner } from "./alert-banner";
import { severityRank } from "./severity";

interface AlertsContainerProps {
  alerts: ComponentAlertFieldsFragment[];
}

export const AlertsContainer: React.FC<AlertsContainerProps> = ({ alerts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(alerts.map((a) => a.internalName ?? a.sys.id)),
  );

  useEffect(() => {
    const stillDismissed = alerts
      .map((a) => a.internalName ?? a.sys.id)
      .filter((key) => localStorage.getItem(`alert-dismissed-${key}`) === "true");
    setDismissed(new Set(stillDismissed));
  }, [alerts]);

  const handleDismiss = (key: string) => {
    localStorage.setItem(`alert-dismissed-${key}`, "true");
    setDismissed((prev) => new Set([...prev, key]));
  };

  const visible = alerts
    .filter((a) => !dismissed.has(a.internalName ?? a.sys.id))
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
    <div ref={containerRef} className="sticky top-0 z-40">
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
