"use client";

import { useContentfulInspectorMode } from "@contentful/live-preview/react";
import type { Document } from "@contentful/rich-text-types";
import { cva } from "class-variance-authority";
import { AlertTriangle, ArrowRight, Info, Sparkles, Wrench, X } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/button";

import type { ComponentAlertFieldsFragment } from "../../lib/__generated/sdk";
import { CtfRichText } from "../contentful/ctf-rich-text";
import { getSeverity } from "./severity";

interface AlertBannerProps {
  alert: ComponentAlertFieldsFragment;
  onDismiss: () => void;
}

const bannerVariants = cva(
  "relative isolate flex items-center gap-x-6 overflow-hidden px-6 py-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-3.5",
  {
    variants: {
      severity: {
        info: "bg-secondary border-b border-primary/5",
        warning: "bg-accent/70 border-b border-primary/5",
        critical: "bg-destructive/10 border-b border-destructive/5",
      },
    },
    defaultVariants: { severity: "info" },
  },
);

const blobVariants = cva("h-28 w-56 rounded-full", {
  variants: {
    severity: {
      info: "from-primary/25 to-accent/30",
      warning: "from-accent/40 to-primary/15",
      critical: "from-destructive/30 to-destructive/20",
    },
  },
  defaultVariants: { severity: "info" },
});

const badgeVariants = cva("flex h-7 w-7 flex-none items-center justify-center rounded-full", {
  variants: {
    severity: {
      info: "bg-primary/10 text-foreground border border-primary/5",
      warning: "bg-accent/80 text-foreground border border-primary/5",
      critical: "bg-destructive/10 text-foreground border border-destructive/5",
    },
  },
  defaultVariants: { severity: "info" },
});

const actionButtonVariants = cva("ml-3 flex-none", {
  variants: {
    severity: {
      info: "",
      warning:
        "bg-status-stale-foreground text-status-stale hover:bg-status-stale-foreground/90 active:bg-status-stale-foreground",
      critical:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive",
    },
  },
  defaultVariants: { severity: "info" },
});

const typeIcons: Partial<Record<string, React.ElementType>> = {
  info: Info,
  degraded_service: AlertTriangle,
  maintenance: Wrench,
  new_feature: Sparkles,
};

export const AlertBanner: React.FC<AlertBannerProps> = ({ alert, onDismiss }) => {
  const [shown, setShown] = useState(false);
  const inspectorProps = useContentfulInspectorMode({ entryId: alert.sys.id });

  const severity = getSeverity(alert);

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
          className={`${bannerVariants({ severity })} ${shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
          role="alert"
        >
          <div
            aria-hidden="true"
            className="absolute -left-24 top-1/2 -z-10 -translate-y-1/2 opacity-50 blur-3xl"
          >
            <div className={`${blobVariants({ severity })} bg-gradient-to-r`} />
          </div>

          <div
            aria-hidden="true"
            className="absolute -right-24 top-1/2 -z-10 -translate-y-1/2 opacity-50 blur-3xl"
          >
            <div className={`${blobVariants({ severity })} bg-gradient-to-l`} />
          </div>

          <div className="text-foreground flex min-w-0 flex-1 items-center justify-center gap-x-3">
            {(() => {
              const Icon = typeIcons[alert.type ?? ""];

              return Icon ? (
                <span className={badgeVariants({ severity })}>
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : null;
            })()}

            <div className="text-foreground min-w-0 text-sm/6">
              <strong className="font-semibold" {...inspectorProps({ fieldId: "title" })}>
                {alert.title}
              </strong>

              {alert.body?.json && (
                <svg
                  viewBox="0 0 2 2"
                  aria-hidden="true"
                  className="text-foreground mx-1.5 inline size-0.5 fill-current"
                >
                  <circle r="1" cx="1" cy="1" />
                </svg>
              )}

              {alert.body?.json && (
                <span
                  className="text-foreground [&>*]:inline [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_h1]:hidden [&_h2]:hidden [&_h3]:hidden [&_h4]:hidden [&_h5]:hidden [&_h6]:hidden [&_p]:m-0 [&_p]:inline [&_p]:text-sm"
                  {...inspectorProps({ fieldId: "body" })}
                >
                  <CtfRichText json={alert.body.json as Document} />
                </span>
              )}

              {alert.link?.url && alert.link?.label && (
                <span {...inspectorProps({ fieldId: "link" })}>
                  <Button asChild size="sm" className={actionButtonVariants({ severity })}>
                    <Link href={alert.link.url} target="_blank" rel="noopener noreferrer">
                      {alert.link.label}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </span>
              )}
            </div>
          </div>

          {alert.dismissible && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleDismissClick}
              aria-label="Dismiss alert"
              className="text-muted-foreground hover:bg-foreground/10 flex-none"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
