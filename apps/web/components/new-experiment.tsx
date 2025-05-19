"use client";

import { newExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Button, Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage, Select, SelectItem, SelectContent, Textarea, SelectValue, SelectTrigger,
} from "@repo/ui/components";
import type { CreateExperimentBody } from "@repo/api";
import { zExperimentStatus, zExperimentVisibility } from "@repo/api";
import type z from "zod";
import { toast } from "@repo/ui/hooks";
import { useRouter } from "next/navigation";
import { useExperimentCreate } from "../hooks/experiment/useExperimentCreate/useExperimentCreate";

interface NewExperimentFormProps {
  name?: string;
  visibilityPrivate?: boolean;
}

export function NewExperimentForm({ name, visibilityPrivate }: NewExperimentFormProps) {
  const router = useRouter();
  const { mutateAsync: createExperiment, isPending } = useExperimentCreate();

  const form = useForm<z.infer<typeof newExperimentFormSchema>>({
    resolver: zodResolver(newExperimentFormSchema),
    defaultValues: {
      name: name ?? "",
      description: "",
      status: zExperimentStatus.enum.provisioning,
      visibility: visibilityPrivate !== undefined ? (visibilityPrivate ? zExperimentVisibility.enum.private : zExperimentVisibility.enum.public) : zExperimentVisibility.enum.public,
      embargoIntervalDays: 90,
    },
  });

  function cancel() {
    router.back();
  }

  async function onSubmit(data: z.infer<typeof newExperimentFormSchema>) {
    try {
      // Generate a random userId for demo purposes
      // In a real app, you would get this from authentication context
      const userId = "00000000-0000-0000-0000-000000000000";

      const body: CreateExperimentBody = {
        name: data.name,
        visibility: data.visibility,
      };

      await createExperiment({
        query: { userId },
        body,
      });

      // Show message
      toast({
        description: "Experiment created successfully",
      });
      // Navigate to the list of experiments
      router.push(`/openjii/experiments`);
    } catch (error) {
      toast({
        description: "Failed to create experiment",
        variant: "destructive",
      });
      console.error("Failed to create experiment:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input data-1p-ignore {...field} />
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder=""
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an experiment status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.entries(zExperimentStatus.enum)).map(key => {
                    return <SelectItem key={key[0]} value={key[0]}>{key[0]}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visibility</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an experiment visibility" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.entries(zExperimentVisibility.enum)).map(key => {
                    return <SelectItem key={key[0]} value={key[0]}>{key[0]}</SelectItem>
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embargoIntervalDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Embargo interval days</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="button" onClick={cancel} variant="outline">Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Finalize setup"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
