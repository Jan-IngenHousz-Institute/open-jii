import type { UseFormReturn } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api";
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
  Textarea,
} from "@repo/ui/components";

interface NewProtocolDetailsCardProps {
  form: UseFormReturn<CreateProtocolRequestBody>;
}

export function NewProtocolDetailsCard({ form }: NewProtocolDetailsCardProps) {
  const { t } = useTranslation(undefined, "common");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("newProtocol.detailsTitle")}</CardTitle>
        <CardDescription>{t("newProtocol.detailsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newProtocol.name")}</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>{t("newProtocol.description_field")}</FormLabel>
              <FormControl>
                <Textarea
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder={t("newProtocol.description_field")}
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
