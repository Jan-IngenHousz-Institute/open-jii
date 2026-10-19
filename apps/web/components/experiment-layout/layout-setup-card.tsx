"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type {
  ExperimentLayout,
  ExperimentLayoutSetup,
} from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { zExperimentLayoutSetup } from "@repo/api/domains/experiment/layout/experiment-layout.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
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

import { rowLetter } from "./row-letter";

interface LayoutSetupCardProps {
  layout: ExperimentLayout;
}

export function LayoutSetupCard({ layout }: LayoutSetupCardProps) {
  const { t } = useTranslation("experiments");
  const form = useForm<ExperimentLayoutSetup>({
    resolver: zodResolver(zExperimentLayoutSetup),
    defaultValues: { levelName: layout.levelName, rows: layout.rows, columns: layout.columns },
  });

  const rows = form.watch("rows");
  const columns = form.watch("columns");
  const firstIdentifier = `${rowLetter(1)}1`;
  const lastIdentifier = `${rowLetter(rows)}${columns}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("layout.setupTitle")}</CardTitle>
        <CardDescription>{t("layout.setupDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-4">
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

            <p className="text-muted-foreground text-sm">
              {t("layout.identifierPattern", { first: firstIdentifier, last: lastIdentifier })}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">{t("layout.generate", { count: rows * columns })}</Button>
              <Button type="button" variant="outline">
                {t("layout.paste")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
