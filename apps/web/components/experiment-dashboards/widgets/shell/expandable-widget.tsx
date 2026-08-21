"use client";

import { Maximize2 } from "lucide-react";
import { useContext, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

import { WidgetCardTabSlotContext } from "./widget-card";

interface ExpandableWidgetProps {
  title?: string | null;
  children: ReactNode;
}

export function ExpandableWidget({ title, children }: ExpandableWidgetProps) {
  const { t } = useTranslation("experimentDashboards");
  const [open, setOpen] = useState(false);
  const tabSlotEl = useContext(WidgetCardTabSlotContext);
  const handleOpen = () => setOpen(true);

  const tab = (
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-label={t("widget.expand")}
      onClick={handleOpen}
      data-no-drag=""
      className="text-muted-foreground hover:text-foreground pointer-events-auto translate-y-1 border-b-0 opacity-0 transition-[opacity,transform] duration-150 focus-visible:translate-y-0 focus-visible:opacity-100 group-hover/widget:translate-y-0 group-hover/widget:opacity-100"
    >
      <Maximize2 className="size-3.5" />
    </Button>
  );

  // Mount in exactly one slot at a time so charts/hooks don't double-init.
  return (
    <div className="relative h-full">
      {!open && children}
      {tabSlotEl ? createPortal(tab, tabSlotEl) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[90vh] max-w-[90vw] flex-col">
          <DialogHeader>
            <DialogTitle>{title ?? t("widget.expandedPreview")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("widget.expandedPreviewDescription")}
            </DialogDescription>
          </DialogHeader>
          {open && <div className="min-h-0 flex-1">{children}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
