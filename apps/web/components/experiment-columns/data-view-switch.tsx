"use client";

import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

export type DataView = "tables" | "dictionary";

interface DataViewSwitchProps {
  view: DataView;
  onViewChange: (view: DataView) => void;
}

export function DataViewSwitch({ view, onViewChange }: DataViewSwitchProps) {
  const { t } = useTranslation("studyMetadata");

  const handleChange = (value: string) => {
    if (value === "tables" || value === "dictionary") {
      onViewChange(value);
    }
  };

  return (
    <Tabs value={view} onValueChange={handleChange}>
      <TabsList aria-label={t("dataView.label")} className="h-10">
        <TabsTrigger value="tables" className="px-3">
          {t("dataView.tables")}
        </TabsTrigger>
        <TabsTrigger value="dictionary" className="px-3">
          {t("dataView.dictionary")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
