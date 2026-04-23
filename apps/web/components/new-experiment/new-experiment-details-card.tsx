import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  Input,
  FormMessage,
  RichTextarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components";

import { useWorkbookList } from "../../hooks/workbook/useWorkbookList/useWorkbookList";

interface NewExperimentDetailsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentDetailsCard({ form }: NewExperimentDetailsCardProps) {
  const { t } = useTranslation();

  const { data: workbooks = [] } = useWorkbookList();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newExperiment.detailsTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.detailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.name")}</FormLabel>
              <FormControl>
                <Input {...field} trim />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.description_field")}</FormLabel>
              <FormControl>
                <RichTextarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("newExperiment.descriptionPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workbookId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.workbook")}</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "__none__" ? undefined : value)}
                value={field.value ?? "__none__"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("newExperiment.workbookPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">{t("newExperiment.noWorkbook")}</SelectItem>
                  {workbooks.map((wb) => (
                    <SelectItem key={wb.id} value={wb.id}>
                      {wb.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
