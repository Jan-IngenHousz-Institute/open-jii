import type { UseFormReturn } from "react-hook-form";

import { zExperimentVisibility } from "@repo/api";
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
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@repo/ui/components";

interface NewExperimentVisibilityCardProps {
  form: UseFormReturn<CreateExperimentBody>;
}

export function NewExperimentVisibilityCard({ form }: NewExperimentVisibilityCardProps) {
  const { t } = useTranslation(undefined, "common");
  // Temporary removed:
  // const visibility = form.watch("visibility");
  return (
    <Card className="min-w-0 flex-1">
      <CardHeader>
        <CardTitle>{t("newExperiment.visibilityTitle")}</CardTitle>
        <CardDescription>{t("newExperiment.visibilityDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newExperiment.visibility")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("newExperiment.visibilityPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(zExperimentVisibility.enum).map((key) => {
                    return (
                      <SelectItem key={key[0]} value={key[0]}>
                        {key[0]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* TODO: Temporary removed as the implementation is pending on the backend */}
        {/*{visibility !== zExperimentVisibility.enum.public && (*/}
        {/*  <FormField*/}
        {/*    control={form.control}*/}
        {/*    name="embargoIntervalDays"*/}
        {/*    render={({ field }) => (*/}
        {/*      <FormItem>*/}
        {/*        <FormLabel>{t("newExperiment.embargoIntervalDays")}</FormLabel>*/}
        {/*        <FormControl>*/}
        {/*          <Input*/}
        {/*            type="number"*/}
        {/*            {...field}*/}
        {/*            onChange={(e) => {*/}
        {/*              const value = Number(e.target.value);*/}
        {/*              if (value < 0) return field.onChange(0);*/}
        {/*              return field.onChange(value);*/}
        {/*            }}*/}
        {/*          />*/}
        {/*        </FormControl>*/}
        {/*        <FormMessage />*/}
        {/*      </FormItem>*/}
        {/*    )}*/}
        {/*  />*/}
        {/*)}*/}
      </CardContent>
    </Card>
  );
}
