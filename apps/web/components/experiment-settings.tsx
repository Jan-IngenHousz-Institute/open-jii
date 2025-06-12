"use client";

import { formatDate } from "@/util/date";
import { editExperimentFormSchema } from "@/util/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";

import type { Experiment } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RichTextarea,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useExperiment } from "../hooks/experiment/useExperiment/useExperiment";
import { useExperimentDelete } from "../hooks/experiment/useExperimentDelete/useExperimentDelete";
import { useExperimentMembers } from "../hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentUpdate } from "../hooks/experiment/useExperimentUpdate/useExperimentUpdate";
import { ExperimentMemberManagement } from "./experiment-member-management";

interface ExperimentSettingsProps {
  experimentId: string;
}

export function ExperimentSettings({ experimentId }: ExperimentSettingsProps) {
  const { data, isLoading } = useExperiment(experimentId);

  if (isLoading) {
    return <div>Loading experiment settings...</div>;
  }

  if (!data) {
    return <div>Experiment not found</div>;
  }

  const experiment = data.body;

  return (
    <div className="space-y-6">
      {/* Edit Experiment Details Card - First */}
      <ExperimentDetailsCard
        experimentId={experimentId}
        initialName={experiment.name}
        initialDescription={experiment.description ?? ""}
      />

      {/* Member Management and Visibility Settings - Side by Side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ExperimentMemberManagement experimentId={experimentId} />
        <ExperimentVisibilityCard
          experimentId={experimentId}
          initialVisibility={experiment.visibility}
          initialEmbargoIntervalDays={experiment.embargoIntervalDays}
        />
      </div>

      {/* Experiment Info Card - Last */}
      <ExperimentInfoCard experimentId={experimentId} experiment={experiment} />
    </div>
  );
}

// ===== Experiment Details Card Component =====
interface ExperimentDetailsCardProps {
  experimentId: string;
  initialName: string;
  initialDescription: string;
}

function ExperimentDetailsCard({
  experimentId,
  initialName,
  initialDescription,
}: ExperimentDetailsCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } =
    useExperimentUpdate();

  const form = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(
      editExperimentFormSchema.pick({ name: true, description: true }),
    ),
    defaultValues: {
      name: initialName,
      description: initialDescription,
    },
  });

  async function onSubmit(data: { name: string; description?: string }) {
    await updateExperiment({
      params: { id: experimentId },
      body: data,
    });
    toast({ description: "Experiment details updated successfully" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Experiment Details</CardTitle>
        <CardDescription>
          Update the name and description of your experiment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Experiment name" />
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
                    <RichTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Enter description..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update Details"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ===== Experiment Visibility Card Component =====
interface ExperimentVisibilityCardProps {
  experimentId: string;
  initialVisibility: "private" | "public";
  initialEmbargoIntervalDays: number;
}

function ExperimentVisibilityCard({
  experimentId,
  initialVisibility,
  initialEmbargoIntervalDays,
}: ExperimentVisibilityCardProps) {
  const { mutateAsync: updateExperiment, isPending: isUpdating } =
    useExperimentUpdate();

  interface VisibilityFormValues {
    visibility?: "private" | "public";
    embargoIntervalDays?: number;
  }

  const form = useForm<VisibilityFormValues>({
    resolver: zodResolver(
      editExperimentFormSchema.pick({
        visibility: true,
        embargoIntervalDays: true,
      }),
    ),
    defaultValues: {
      visibility: initialVisibility,
      embargoIntervalDays: initialEmbargoIntervalDays,
    },
  });

  // Watch visibility to conditionally display the embargo field
  const visibility = form.watch("visibility");

  async function onSubmit(data: VisibilityFormValues) {
    // Skip the update if visibility is undefined
    if (data.visibility === undefined) {
      return;
    }

    const updateData = {
      visibility: data.visibility,
      // Only include embargoIntervalDays when visibility is private
      ...(data.visibility === "private" && {
        embargoIntervalDays: data.embargoIntervalDays,
      }),
    };

    await updateExperiment({
      params: { id: experimentId },
      body: updateData,
    });
    toast({ description: "Visibility settings updated successfully" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visibility Settings</CardTitle>
        <CardDescription>
          Control your experiment's visibility and embargo period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(zExperimentVisibility.enum).map(
                        (value) => (
                          <SelectItem key={value} value={value}>
                            {value.charAt(0).toUpperCase() + value.slice(1)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Only show embargo settings when visibility is private */}
            {visibility === "private" && (
              <FormField
                control={form.control}
                name="embargoIntervalDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Embargo Period (days)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update Visibility"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ===== Experiment Information and Deletion Card Component =====
interface ExperimentInfoCardProps {
  experimentId: string;
  experiment: Experiment; // Using any here for simplicity, should be properly typed in a real app
}

function ExperimentInfoCard({
  experimentId,
  experiment,
}: ExperimentInfoCardProps) {
  // Fetch experiment members to get admin info
  const { data: membersData } = useExperimentMembers(experimentId);

  const members = useMemo(() => {
    return membersData?.body ?? [];
  }, [membersData]);

  // Find the admin member (creator)
  const adminMember = useMemo(() => {
    return members.find((m) => m.role === "admin");
  }, [members]);

  // Helper to get name/email from admin member
  const adminName =
    (adminMember?.user.name ??
      adminMember?.user.email ??
      experiment.createdBy) ||
    "Unknown";
  const adminEmail = adminMember?.user.email;

  const { mutateAsync: deleteExperiment, isPending: isDeleting } =
    useExperimentDelete();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();

  const handleDeleteExperiment = async () => {
    await deleteExperiment({ params: { id: experimentId } });
    toast({
      description: "Experiment deleted successfully",
    });
    router.push("/openjii/experiments");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Experiment Information</CardTitle>
        <CardDescription>
          View experiment details and danger zone options
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-x-2">
            <span className="font-medium">Created by:</span> {adminName}
            {adminEmail && adminEmail !== adminName ? (
              <span className="text-muted-foreground flex items-center gap-x-1">
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate text-xs md:max-w-[200px] md:text-sm">
                  {adminEmail}
                </span>
              </span>
            ) : null}
          </div>
          <div>
            <span className="font-medium">Created at:</span>{" "}
            {formatDate(experiment.createdAt)}
          </div>
          <div>
            <span className="font-medium">Last updated:</span>{" "}
            {formatDate(experiment.updatedAt)}
          </div>
        </div>

        <div className="border-t pt-4">
          <h5 className="text-destructive mb-2 text-base font-medium">
            Danger Zone
          </h5>
          <p className="text-muted-foreground mb-4 text-sm">
            Once you delete an experiment, there is no going back. Please be
            certain.
          </p>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Experiment
            </Button>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                Are you sure you want to delete "{experiment.name}"? This action
                cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteExperiment}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
