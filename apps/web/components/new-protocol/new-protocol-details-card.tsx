import type { UseFormReturn } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  Input,
  FormMessage,
  RichTextarea,
} from "@repo/ui/components";

interface NewProtocolDetailsCardProps {
  form: UseFormReturn<CreateProtocolRequestBody>;
}

export function NewProtocolDetailsCard({ form }: NewProtocolDetailsCardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("newProtocol.detailsTitle")}</h3>
        <p className="text-muted-foreground text-sm">{t("newProtocol.detailsDescription")}</p>
      </div>
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
    </div>
  );
}
