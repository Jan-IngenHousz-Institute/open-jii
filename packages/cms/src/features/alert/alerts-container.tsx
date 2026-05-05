"use client";

import React, { useEffect, useRef, useState } from "react";

import type { ComponentAlertFieldsFragment } from "../../lib/__generated/sdk";
import { AlertBanner } from "./alert-banner";

interface AlertsContainerProps {
  alerts: ComponentAlertFieldsFragment[];
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export const AlertsContainer: React.FC<AlertsContainerProps> = ({ alerts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(
    () => new Set(alerts.map((a) => a.sys.id)),
  );

  useEffect(() => {
    const stillDismissed = alerts
      .map((a) => a.sys.id)
      .filter((id) => localStorage.getItem(`alert-dismissed-${id}`) === "true");
    setDismissed(new Set(stillDismissed));
  }, [alerts]);

  const handleDismiss = (id: string) => {
    localStorage.setItem(`alert-dismissed-${id}`, "true");
    setDismissed((prev) => new Set([...prev, id]));
  };

  const visible = alerts
    .filter((a) => !dismissed.has(a.sys.id))
    .sort((a, b) => {
      const aOrder = SEVERITY_ORDER[(a.severity ?? "info") as keyof typeof SEVERITY_ORDER] ?? 2;
      const bOrder = SEVERITY_ORDER[(b.severity ?? "info") as keyof typeof SEVERITY_ORDER] ?? 2;
      return aOrder - bOrder;
    });

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
        <AlertBanner key={alert.sys.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
