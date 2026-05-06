"use client";

import type { Document } from "@contentful/rich-text-types";
import { AlertTriangle, Info, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import type { ComponentAlertFieldsFragment } from "../../lib/__generated/sdk";
import { CtfRichText } from "../contentful/ctf-rich-text";

interface AlertBannerProps {
  alert: ComponentAlertFieldsFragment;
  onDismiss: () => void;
}

const severityStyles = {
  info: {
    bg: "bg-quaternary border-b border-primary/5",
    text: "text-primary",
    secondaryText: "text-primary/85",
    blob: "from-jii-bright-green/25 to-jii-light-blue/30",
    button: "bg-primary text-white hover:bg-primary-dark",
    dismiss: "text-primary/50 hover:bg-primary/5 hover:text-primary",
    badge: "bg-primary/10 text-primary border border-primary/5",
  },
  warning: {
    bg: "bg-highlight-light border-b border-primary/5",
    text: "text-primary",
    secondaryText: "text-primary/85",
    blob: "from-highlight/40 to-jii-bright-green/15",
    button: "bg-primary text-white hover:bg-primary-dark",
    dismiss: "text-primary/50 hover:bg-primary/5 hover:text-primary",
    badge: "bg-highlight/80 text-primary border border-primary/5",
  },
  critical: {
    bg: "bg-red-50 border-b border-red-900/5",
    text: "text-red-900",
    secondaryText: "text-red-900/80",
    blob: "from-red-300/30 to-rose-200/20",
    button: "bg-red-800 text-white hover:bg-red-900",
    dismiss: "text-red-400 hover:bg-red-900/5 hover:text-red-700",
    badge: "bg-red-200 text-red-800 border border-red-900/5",
  },
} as const;

const typeIcons: Partial<Record<string, React.ElementType>> = {
  info: Info,
  degraded_service: AlertTriangle,
  maintenance: Wrench,
  new_feature: Sparkles,
};

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onDismiss }) => {
  const [shown, setShown] = useState(false);

  const severity = (alert.severity ?? "info") as keyof typeof severityStyles;
  const styles = severityStyles[severity] ?? severityStyles.info;

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDismissClick = () => setShown(false);

  return (
    <div
      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
        shown ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
      onTransitionEnd={(e) => {
        if (!shown && e.propertyName === "grid-template-rows") {
          onDismiss();
        }
      }}
    >
      <div className="overflow-hidden">
        <div
          className={`relative isolate flex items-center gap-x-6 overflow-hidden px-6 py-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-3.5 ${
            styles.bg
          } ${shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
          role="alert"
        >
          <div
            aria-hidden="true"
            className="absolute -left-24 top-1/2 -z-10 -translate-y-1/2 opacity-50 blur-3xl"
          >
            <div className={`h-28 w-56 rounded-full bg-gradient-to-r ${styles.blob}`} />
          </div>

          <div
            aria-hidden="true"
            className="absolute -right-24 top-1/2 -z-10 -translate-y-1/2 opacity-50 blur-3xl"
          >
            <div className={`h-28 w-56 rounded-full bg-gradient-to-l ${styles.blob}`} />
          </div>

          <div className={`flex min-w-0 flex-1 items-center justify-center gap-x-3 ${styles.text}`}>
            {(() => {
              const Icon = typeIcons[alert.type ?? ""];

              return Icon ? (
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full ${styles.badge}`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null;
            })()}

            <div className={`min-w-0 text-sm/6 ${styles.text}`}>
              <strong className="font-semibold">{alert.title}</strong>

              {alert.body?.json && (
                <svg
                  viewBox="0 0 2 2"
                  aria-hidden="true"
                  className={`mx-1.5 inline size-0.5 fill-current ${styles.secondaryText}`}
                >
                  <circle r="1" cx="1" cy="1" />
                </svg>
              )}

              {alert.body?.json && (
                <span
                  className={`${styles.secondaryText} [&>*]:inline [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h1]:hidden [&_h2]:hidden [&_h3]:hidden [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:m-0 [&_p]:inline [&_p]:text-sm`}
                >
                  <CtfRichText json={alert.body.json as Document} />
                </span>
              )}

              {alert.link?.url && alert.link?.label && (
                <Link
                  href={alert.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`ml-3 inline-flex flex-none items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${styles.button}`}
                >
                  {alert.link.label} →
                </Link>
              )}
            </div>
          </div>

          {alert.dismissible && (
            <button
              type="button"
              onClick={handleDismissClick}
              className={`flex-none rounded-full p-2 transition-colors focus-visible:-outline-offset-4 ${styles.dismiss}`}
              aria-label="Dismiss alert"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
