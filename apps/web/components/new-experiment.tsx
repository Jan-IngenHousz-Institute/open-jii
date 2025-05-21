"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody } from "@repo/api";
import { zCreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectItem,
  SelectContent,
  Textarea,
  SelectValue,
  SelectTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperimentCreate } from "../hooks/experiment/useExperimentCreate/useExperimentCreate";

interface NewExperimentFormProps {
  name?: string;
  visibilityPrivate?: boolean;
}

export function NewExperimentForm({
  name,
  visibilityPrivate,
}: NewExperimentFormProps) {
  const router = useRouter();
  const { mutateAsync: createExperiment, isPending } = useExperimentCreate();

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: name ?? "",
      description: "",
      visibility: visibilityPrivate
        ? zExperimentVisibility.enum.private
        : zExperimentVisibility.enum.public,
      embargoIntervalDays: 90,
    },
  });

  function cancel() {
    router.back();
  }

  async function onSubmit(data: CreateExperimentBody) {
    try {
      const body: CreateExperimentBody = {
        name: data.name,
        description: data.description,
        visibility: data.visibility,
        embargoIntervalDays: data.embargoIntervalDays,
      };

      await createExperiment({
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
                <Textarea placeholder="" className="resize-none" {...field} />
              </FormControl>
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
          <Button type="button" onClick={cancel} variant="outline">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Finalize setup"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
