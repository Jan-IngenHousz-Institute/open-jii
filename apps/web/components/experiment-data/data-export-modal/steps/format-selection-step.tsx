"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useTranslation } from "@repo/i18n/client";
import {
  Button,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

const formatSelectionSchema = z.object({
  format: z.string().min(1, "Please select a format"),
});

type FormatSelectionValues = z.infer<typeof formatSelectionSchema>;

interface FormatSelectionStepProps {
  onFormatSubmit: (format: string) => void;
  onBack: () => void;
  onClose: () => void;
  isCreating?: boolean;
}

export function FormatSelectionStep({
  onFormatSubmit,
  onBack,
  onClose,
  isCreating,
}: FormatSelectionStepProps) {
  const { t } = useTranslation("experimentData");

  const form = useForm<FormatSelectionValues>({
    resolver: zodResolver(formatSelectionSchema),
    defaultValues: {
      format: "",
    },
  });

  const onSubmit = (data: FormatSelectionValues) => {
    onFormatSubmit(data.format);
  };

  return (
    <div className="grid gap-4 py-4">
      <Form {...form}>
        <form
          id="format-selection-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem>
                <div className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">
                    {t("experimentData.downloadModal.format")}
                  </FormLabel>
                  <div className="col-span-3">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="parquet">Parquet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={onBack} className="w-full sm:w-auto">
          {t("common.back")}
        </Button>
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          {t("common.close")}
        </Button>
        <Button
          type="submit"
          disabled={!form.watch("format") || isCreating}
          className="w-full sm:w-auto"
          form="format-selection-form"
        >
          {isCreating ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              {t("experimentData.exportModal.creating")}
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              {t("experimentData.exportModal.createExport")}
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
