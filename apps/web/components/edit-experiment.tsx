"use client";

import type { Experiment} from "@/util/schema";
import { experimentSchema } from "@/util/schema";
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
import { editExperiment } from "@/util/actions";
import { zExperimentStatus, zExperimentVisibility } from "@repo/api";
import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";

interface EditExperimentProps {
  experimentId: string;
}

export function EditExperiment({ experimentId }: EditExperimentProps) {      // Generate a random userId for demo purposes
  // In a real app, you would get this from authentication context
  const userId = "00000000-0000-0000-0000-000000000000";

  const { data } = useExperiment(experimentId, userId);

  if (data) {
    const experiment: Experiment = {
      id: experimentId,
      name: data.body.name,
      description: data.body.description ?? "",
      visibility: data.body.visibility,
      status: data.body.status,
      embargoIntervalDays: data.body.embargoIntervalDays,
    }
    return <EditExperimentForm experiment={experiment}/>;
  }
}

interface EditExperimentFormProps {
  experiment: Experiment;
}

export function EditExperimentForm({ experiment }: EditExperimentFormProps) {
  const form = useForm<Experiment>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      ...experiment,
    },
  });

  return (
    <Form {...form}>
      <form action={editExperiment}>
        <div className="flex flex-1 flex-col gap-3 p-4 pt-0">
            <div className="bg-muted/50 aspect-video rounded-xl">
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
                      <Input data-1p-ignore {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Save</Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
