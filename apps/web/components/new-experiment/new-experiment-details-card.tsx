import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
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
} from "@repo/ui/components";

interface NewExperimentDetailsCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentDetailsCard({ form }: NewExperimentDetailsCardProps) {
  const { t } = useTranslation();
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
      </CardContent>
    </Card>
  );
}
