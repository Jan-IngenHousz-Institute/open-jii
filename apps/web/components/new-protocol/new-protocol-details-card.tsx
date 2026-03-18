import type { UseFormReturn } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  FormField,
  FormItem,
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
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input {...field} trim placeholder={t("newProtocol.name")} />
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
