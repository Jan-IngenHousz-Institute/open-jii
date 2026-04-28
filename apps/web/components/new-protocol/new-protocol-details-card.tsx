"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { SENSOR_FAMILY_OPTIONS } from "@/util/sensor-family";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { Macro } from "@repo/api/schemas/macro.schema";
import type { CreateProtocolRequestBody } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { RichTextarea } from "@repo/ui/components/rich-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { tsr } from "../../lib/tsr";
import { MacroSearchWithDropdown } from "../macro-search-with-dropdown";

interface NewProtocolDetailsCardProps {
  form: UseFormReturn<CreateProtocolRequestBody>;
  selectedMacros: Macro[];
  onAddMacro: (macro: Macro) => void;
  onRemoveMacro: (macroId: string) => void;
}

export function NewProtocolDetailsCard({
  form,
  selectedMacros,
  onAddMacro,
  onRemoveMacro,
}: NewProtocolDetailsCardProps) {
  const { t } = useTranslation();

  // Macro search
  const [macroSearch, setMacroSearch] = useState("");
  const [debouncedMacroSearch, isDebounced] = useDebounce(macroSearch, 300);
  const { data: macroData } = tsr.macros.listMacros.useQuery({
    queryData: {
      query: { search: debouncedMacroSearch || undefined },
    },
    queryKey: ["macros", "search", debouncedMacroSearch],
  });
  const macroList = macroData?.body;

  const selectedMacroIds = useMemo(
    () => new Set(selectedMacros.map((m) => m.id)),
    [selectedMacros],
  );

  const availableMacros: Macro[] = useMemo(
    () => (macroList ?? []).filter((m) => !selectedMacroIds.has(m.id)),
    [macroList, selectedMacroIds],
  );

  const handleAddMacro = (macroId: string) => {
    const macro = macroList?.find((m) => m.id === macroId);
    if (macro) {
      onAddMacro(macro);
      setMacroSearch("");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newProtocol.detailsTitle")}</CardTitle>
        <CardDescription>{t("newProtocol.detailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name + Family — side by side */}
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newProtocol.name")}</FormLabel>
                <FormControl>
                  <Input {...field} trim />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="family"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("newProtocol.family")}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("newProtocol.selectFamily")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SENSOR_FAMILY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                        {opt.disabled ? ` (${t("common.comingSoon")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newProtocol.description_field")}</FormLabel>
              <FormControl>
                <RichTextarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("newProtocol.description_field")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Compatible Macros */}
        <div className="space-y-3">
          <div>
            <FormLabel>{t("newProtocol.compatibleMacros")}</FormLabel>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("newProtocol.compatibleMacrosDescription")}
            </p>
          </div>
          {selectedMacros.length > 0 && (
            <div className="space-y-2">
              {selectedMacros.map((macro) => (
                <div
                  key={macro.id}
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{macro.name}</span>
                    <span className="text-muted-foreground text-xs">{macro.language}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`${t("common.remove")} ${macro.name}`}
                    onClick={() => onRemoveMacro(macro.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <MacroSearchWithDropdown
            availableMacros={availableMacros}
            value=""
            placeholder={t("protocolSettings.addCompatibleMacro")}
            loading={!isDebounced}
            searchValue={macroSearch}
            onSearchChange={setMacroSearch}
            onAddMacro={handleAddMacro}
            isAddingMacro={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
