"use client";

import { createExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";

import { Button, DialogClose } from "@repo/ui/components";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from "@repo/ui/components";

export function CreateExperiment() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<z.output<typeof createExperimentFormSchema>>({
    resolver: zodResolver(createExperimentFormSchema),
    defaultValues: {
      name: "",
      visibilityPrivate: false,
    },
  });

  function onSubmit(data: z.infer<typeof createExperimentFormSchema>) {
    // Close the dialog and navigate to the new experiment page
    setOpen(false);
    router.push(
      `/openjii/experiments/new?name=${encodeURIComponent(data.name)}&visibilityPrivate=${encodeURIComponent(data.visibilityPrivate)}`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Create Experiment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
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
                name="visibilityPrivate"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-4 items-center gap-4">
                    <FormLabel>Private</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Go back</Button>
              </DialogClose>
              <Button type="submit">Continue</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
