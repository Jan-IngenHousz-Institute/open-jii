"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog";
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
import { Label } from "@repo/ui/label";
import { Input } from "@repo/ui/input";
import { Switch } from "@repo/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { createExperimentSchema } from "@/util/schema";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { redirect } from "next/navigation";
import { createExperiment } from "@/util/experiments";

export function CreateExperiment() {
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<z.output<typeof createExperimentSchema>>({
    resolver: zodResolver(createExperimentSchema),
    defaultValues: {
      name: "",
      private: true,
    },
  });

  function onSubmit(data: z.infer<typeof createExperimentSchema>) {
    const id = createExperiment(data);
    redirect(`/experiments/${id}`);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Create Experiment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>New experiment</DialogTitle>
              <DialogDescription>
                Set up a new experiment (project).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
            <DialogFooter>
              <Button type="submit">Continue</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
