"use client";

import { ChevronDown, TriangleAlert } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import type {
  ExperimentLayoutSetup,
  LayoutNaming,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zLayoutNaming } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { LayoutNamingScheme } from "./layout-naming";
import type { LayoutPreview } from "./layout-preview";
import { LayoutTermSelect } from "./layout-term-select";
import { UnitName } from "./unit-name";

interface LayoutSetupCardProps {
  form: UseFormReturn<ExperimentLayoutSetup>;
  preview: LayoutPreview;
  /** Create makes the first layout; edit changes a saved one. */
  mode: "create" | "edit";
  onSubmit: (setup: ExperimentLayoutSetup) => void;
  onCancel: () => void;
  /** Opens the import with plot, row and column columns, in place of generating names. */
  onPasteList?: () => void;
}

const NAMING_LABELS: Record<LayoutNaming, string> = {
  rowLetter: "layout.naming.rowLetter",
  runningNumber: "layout.naming.runningNumber",
  rowColumn: "layout.naming.rowColumn",
};

export function LayoutSetupCard({
  form,
  preview,
  mode,
  onSubmit,
  onCancel,
  onPasteList,
}: LayoutSetupCardProps) {
  const { t } = useTranslation("experiments");

  const setup = form.watch();
  const unitName = new UnitName(setup.levelName || t("layout.defaultUnitName"));
  const naming = new LayoutNamingScheme(setup.naming, preview.layout.columns, setup.firstNumber);
  const range = naming.range(preview.layout.rows);
  const isRunningNumber = setup.naming === "runningNumber";
  const isCreating = mode === "create";
  const removed = preview.removedPlots;
  const hasRemovals = removed.length > 0;

  const handleSubmit = form.handleSubmit(onSubmit);

  const renderNamingOption = (option: LayoutNaming) => (
    <SelectItem key={option} value={option}>
      {t(NAMING_LABELS[option])}
    </SelectItem>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isCreating ? t("layout.setup.createTitle") : t("layout.setup.editTitle")}
        </CardTitle>
        <CardDescription>{t("layout.setup.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="levelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.levelName")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>{t("layout.levelNameHelp")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="rows"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.rows")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="columns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.columns")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <FormField
                control={form.control}
                name="naming"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("layout.naming.label")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>{zLayoutNaming.options.map(renderNamingOption)}</SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {isRunningNumber ? (
                <FormField
                  control={form.control}
                  name="firstNumber"
                  render={({ field }) => (
                    <FormItem className="w-24">
                      <FormLabel>{t("layout.naming.firstNumber")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <p className="text-muted-foreground text-sm">
              {t("layout.naming.range", { ...range, units: unitName.plural })}
            </p>

            <Collapsible className="rounded-md border" data-term-section>
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
                {t("layout.term.section")}
                <ChevronDown
                  className="size-4 transition-transform group-data-[state=open]:rotate-180"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 px-3 pb-3">
                <FormField
                  control={form.control}
                  name="levelTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">{t("layout.term.label")}</FormLabel>
                      <FormControl>
                        <LayoutTermSelect value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormDescription>{t("layout.term.help")}</FormDescription>
                    </FormItem>
                  )}
                />
              </CollapsibleContent>
            </Collapsible>

            {hasRemovals ? (
              <Alert>
                <TriangleAlert aria-hidden />
                <AlertDescription>
                  {t("layout.setup.removes", {
                    ...unitName.forCount(removed.length),
                    measured: preview.measuredRemovedCount,
                  })}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit">
                {isCreating
                  ? t("layout.setup.create", unitName.forCount(preview.plotCount))
                  : t("layout.setup.save")}
              </Button>
              {isCreating && onPasteList ? (
                <Button type="button" variant="outline" onClick={onPasteList}>
                  {t("layout.setup.pasteList")}
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={onCancel}>
                {t("layout.setup.cancel")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
