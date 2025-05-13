"use client";

import { createExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type z from "zod";

import { Button } from "@repo/ui/components";
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

import { useExperimentCreate } from "../hooks/experiment/useExperimentCreate/useExperimentCreate";
import type { CreateExperimentBody} from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { toast } from "@repo/ui/hooks";

export function CreateExperiment() {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { mutateAsync: createExperiment, isPending } = useExperimentCreate();

  const form = useForm<z.output<typeof createExperimentFormSchema>>({
    resolver: zodResolver(createExperimentFormSchema),
    defaultValues: {
      name: "",
      visibilityPrivate: false,
    },
  });

  async function onSubmit(data: z.infer<typeof createExperimentFormSchema>) {
    try {
      // Generate a random userId for demo purposes
      // In a real app, you would get this from authentication context
      const userId = "00000000-0000-0000-0000-000000000000";

      const body: CreateExperimentBody = {
        name: data.name,
        visibility: data.visibilityPrivate ? zExperimentVisibility.enum.private : zExperimentVisibility.enum.public,
      };

      const result = await createExperiment({
        query: { userId },
        body,
      });

      // Show message
      toast({
        description: "New experiment created successfully",
      });
      // Close the dialog and navigate to the new experiment
      setOpen(false);
      router.push(`/openjii/experiments/${result.body.id}`);
    } catch (error) {
      toast({
        description: "Failed to create experiment",
        variant: "destructive",
      });
      console.error("Failed to create experiment:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Continue"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
