"use client";

import type { Experiment } from "@/util/schema";
import { experimentSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type z from "zod";

import { Button } from "@repo/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/form";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Switch } from "@repo/ui/switch";

interface NewExperimentProps {
  experiment: Experiment;
}

export function NewExperiment({ experiment }: NewExperimentProps) {
  const form = useForm<z.output<typeof experimentSchema>>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      ...experiment,
    },
  });

  return (
    <Form {...form}>
      <form>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-2">
            <div className="bg-muted/50 aspect-video rounded-xl">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input className="col-span-3" data-1p-ignore {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="private"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="private" className="text-right">
                      Private
                    </Label>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormItem>
                )}
              />
            </div>
            <div className="bg-muted/50 aspect-video rounded-xl">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input className="col-span-3" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <div className="grid auto-rows-min gap-4 md:grid-cols-2">
            <div className="bg-muted/50 aspect-video rounded-xl">
              <Button type="submit">Save</Button>
            </div>
            <div className="bg-muted/50 aspect-video rounded-xl"></div>
          </div>
        </div>
      </form>
    </Form>
  );
}
