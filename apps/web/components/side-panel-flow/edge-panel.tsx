import { SettingsCard } from "@/components/shared/settings-card";
import type { Edge } from "@xyflow/react";
import React, { useState, useEffect } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

// A dimmer has to darken whatever is behind it, identically in light and dark, so
// it is the same fixed wash the packages/ui modal scrims use rather than a token.
// eslint-disable-next-line no-restricted-syntax -- A scrim is theme-independent by design
const backdrop = "bg-black/50";

export interface EdgeSidePanelProps {
  open: boolean;
  selectedEdge: Edge | null;
  onClose: () => void;
  onEdgeUpdate?: (edgeId: string, updates: Partial<Edge>) => void;
  onEdgeDelete?: (edgeId: string) => void;
  isDisabled?: boolean;
}

export function EdgeSidePanel({
  open,
  selectedEdge,
  onClose,
  onEdgeUpdate,
  onEdgeDelete,
  isDisabled = false,
}: EdgeSidePanelProps) {
  // Keep previous content during transition
  const [displayEdge, setDisplayEdge] = useState<Edge | null>(selectedEdge);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const newLabel = e.target.value;
    if (displayEdge) {
      const updatedEdge = { ...displayEdge, data: { ...displayEdge.data, label: newLabel } };
      setDisplayEdge(updatedEdge);
      onEdgeUpdate?.(displayEdge.id, { data: { ...displayEdge.data, label: newLabel } });
    }
  };

  const handleDeleteEdge = () => {
    if (isDisabled) return;
    if (displayEdge && onEdgeDelete) {
      onEdgeDelete(displayEdge.id);
      onClose();
    }
  };

  // Helper to get the label string for the input
  const getEdgeLabel = (edge: Edge | null): string => {
    if (!edge) return "";
    const label = edge.data?.label ?? edge.label;
    return typeof label === "string" || typeof label === "number" ? String(label) : "";
  };

  useEffect(() => {
    if (open && selectedEdge) {
      // Immediately update content when opening
      setDisplayEdge(selectedEdge);
    }
  }, [open, selectedEdge]);

  const { t } = useTranslation("experiments");
  return (
    <>
      {/* Always render backdrop for fade animation */}
      <div
        className={
          `${backdrop} fixed inset-0 z-[80] transition-opacity duration-300 ` +
          (open && selectedEdge
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0")
        }
        onClick={onClose}
        aria-label={t("edgePanel.closeBackdrop")}
      />
      <div
        className={
          "bg-card fixed bottom-0 right-0 top-0 z-[80] flex w-full flex-col rounded-none border-none shadow-none transition-transform duration-300 ease-in-out " +
          "md:border-border md:w-[480px] md:rounded-bl-xl md:rounded-tl-xl md:border-l md:shadow-2xl" +
          (open && selectedEdge ? " translate-x-0" : " translate-x-full")
        }
      >
        <div className="flex-1 overflow-y-auto p-6">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-primary hover:text-primary/80 absolute right-4 top-4 text-xl font-bold"
            onClick={onClose}
          >
            &times;
          </Button>
          <h2 className="text-primary mb-4 text-xl font-bold">{t("edgePanel.settings")}</h2>

          {/* Edge Label */}
          <SettingsCard title={t("edgePanel.label")}>
            <Input
              id="edge-label"
              type="text"
              value={getEdgeLabel(displayEdge)}
              onChange={handleLabelChange}
              placeholder={t("edgePanel.labelPlaceholder")}
              disabled={isDisabled}
              className="w-full"
            />
          </SettingsCard>

          {/* Edge Actions */}
          <SettingsCard title={t("edgePanel.actions")}>
            <div className="flex justify-center">
              <Button
                type="button"
                variant="destructive"
                className="font-semibold"
                onClick={handleDeleteEdge}
                disabled={isDisabled}
              >
                {t("edgePanel.remove")}
              </Button>
            </div>
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
