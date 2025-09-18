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
  onClose: () => void;
}

export function FormatSelectionStep({ onFormatSubmit, onClose }: FormatSelectionStepProps) {
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
        <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
          {t("common.close")}
        </Button>
        <Button
          type="submit"
          disabled={!form.watch("format")}
          className="w-full sm:w-auto"
          form="format-selection-form"
        >
          <Download className="mr-2 h-4 w-4" />
          {t("experimentData.downloadModal.generateLinks")}
        </Button>
      </DialogFooter>
    </div>
  );
}
