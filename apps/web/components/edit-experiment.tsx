"use client";

import type { EditExperimentForm } from "@/util/schema";
import { editExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type z from "zod";

import type { UpdateExperimentBody } from "@repo/api";
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

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { useExperimentUpdate } from "../hooks/experiment/useExperimentUpdate/useExperimentUpdate";

interface EditExperimentProps {
  experimentId: string;
}

export function EditExperiment({ experimentId }: EditExperimentProps) {
  const { data } = useExperiment(experimentId);

  if (data) {
    const experiment: EditExperimentForm = {
      id: experimentId,
      name: data.body.name,
      description: data.body.description ?? "",
      visibility: data.body.visibility,
      embargoIntervalDays: data.body.embargoIntervalDays,
    };
    return <EditExperimentForm experiment={experiment} />;
  }
}

interface EditExperimentFormProps {
  experiment: EditExperimentForm;
}

export function EditExperimentForm({ experiment }: EditExperimentFormProps) {
  const router = useRouter();
  const { mutateAsync: updateExperiment, isPending } = useExperimentUpdate();

  const form = useForm<EditExperimentForm>({
    resolver: zodResolver(editExperimentFormSchema),
    defaultValues: {
      ...experiment,
    },
  });

  function cancel() {
    router.back();
  }

  async function onSubmit(data: z.infer<typeof editExperimentFormSchema>) {
    try {
      const body: UpdateExperimentBody = {
        name: data.name,
        description: data.description,
        visibility: data.visibility,
        embargoIntervalDays: data.embargoIntervalDays,
      };

      await updateExperiment({
        params: { id: experiment.id },
        body,
      });

      // Show message
      toast({
        description: "Experiment updated successfully",
      });
      // Navigate to the list of experiments
      router.push(`/openjii/experiments`);
    } catch (error) {
      toast({
        description: "Failed to update experiment",
        variant: "destructive",
      });
      console.error("Failed to update experiment:", error);
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
                <Input data-1p-ignore {...field} />
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
            {isPending ? "Updating..." : "Update"}
          </Button>
        </div>
        <Button type="submit">Update experiment</Button>
      </form>
    </Form>
  );
}
