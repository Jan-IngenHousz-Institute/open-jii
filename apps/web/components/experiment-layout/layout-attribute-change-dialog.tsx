"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import type { PlotAttributeChange } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zPlotAttributeChange } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";

import { AttributeChangeFields } from "./attribute-change-fields";

interface LayoutAttributeChangeDialogProps {
  plotName: string;
  attributeName: string;
  /** The value in force today, which a planned change keeps before its date. */
  currentValue: string;
  onClose: () => void;
}

// The en-CA locale writes a local calendar date as YYYY-MM-DD.
function today(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Edit on one attribute of one plot, which asks whether the change is planned or a correction. */
export function LayoutAttributeChangeDialog({
  plotName,
  attributeName,
  currentValue,
  onClose,
}: LayoutAttributeChangeDialogProps) {
  const { t } = useTranslation("experiments");

  const form = useForm<PlotAttributeChange>({
    resolver: zodResolver(zPlotAttributeChange),
    defaultValues: { kind: "planned", value: "", appliesFrom: today(), reason: null },
  });

  // Scaffold: storing a version is not built yet.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onClose)(event);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const labels = {
    planned: t("layout.change.planned"),
    plannedHelp: t("layout.change.plannedHelp", { value: currentValue }),
    correction: t("layout.change.correction"),
    correctionHelp: t("layout.change.correctionHelp", { value: currentValue }),
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>
            {t("layout.change.title", { name: attributeName, plot: plotName })}
          </DialogTitle>
          <DialogDescription>
            {t("layout.change.description", { name: attributeName, value: currentValue })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("layout.change.newValue")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AttributeChangeFields labels={labels} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("layout.change.cancel")}
              </Button>
              <Button type="submit">{t("layout.change.save")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
