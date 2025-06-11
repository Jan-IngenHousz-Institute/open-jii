"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useUserSearch } from "@/hooks/useUserSearch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody, User } from "@repo/api";
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
  RichTextarea,
  SelectValue,
  SelectTrigger,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useDebounce } from "../hooks/useDebounce";
import { UserSearchWithDropdown } from "./user-search-with-dropdown";

export function NewExperimentForm() {
  const router = useRouter();
  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: () => {
      toast({
        description: "Experiment created successfully",
      });
      // Navigate to the experiment page
      router.push(`/openjii/experiments`);
    },
  });

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: "",
      description: "",
      visibility: zExperimentVisibility.enum.private,
      embargoIntervalDays: 90,
      members: [],
    },
  });

  // Member management state
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } =
    useUserSearch(debouncedSearch);
  const [selectedUserId, setSelectedUserId] = useState("");

  // Use form for members instead of useState
  const members = form.watch("members") ?? [];

  // Filter available users (exclude already added)
  const availableUsers =
    userSearchData?.body.filter(
      (user: User) => !members.some((m) => m.userId === user.id),
    ) ?? [];

  // Add member handler
  const handleAddMember = (userId?: string): Promise<void> => {
    const idToAdd = userId ?? selectedUserId;
    if (!idToAdd) return Promise.resolve();
    const user = availableUsers.find((u) => u.id === idToAdd);
    if (!user) return Promise.resolve();
    form.setValue("members", [
      ...members,
      { userId: user.id, role: "member" as const },
    ]);
    setSelectedUserId("");
    setUserSearch("");
    return Promise.resolve();
  };

  // Remove member handler
  const handleRemoveMember = (userId: string) => {
    form.setValue(
      "members",
      members.filter((m) => m.userId !== userId),
    );
  };

  function cancel() {
    router.back();
  }

  function onSubmit(data: CreateExperimentBody) {
    const payload = {
      ...data,
      members: members.map((m) => ({
        userId: m.userId,
        role: "member" as const,
      })),
    };

    return createExperiment({
      body: payload,
    });
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
                <Input {...field} />
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
                <Input
                  type="number"
                  {...field}
                  onChange={(event) => field.onChange(+event.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Member selection UI */}
        <div>
          <FormLabel>Add Members</FormLabel>
          <div className="mb-2">
            <UserSearchWithDropdown
              availableUsers={availableUsers}
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              placeholder="Search users to add"
              loading={!isDebounced || isFetchingUsers}
              searchValue={userSearch}
              onSearchChange={setUserSearch}
              onAddUser={handleAddMember}
              isAddingUser={false}
            />
          </div>
          <div className="space-y-2">
            {members.length === 0 && (
              <div className="text-muted-foreground text-sm">
                No members added yet
              </div>
            )}
            {members.map((member) => {
              // Find user info for display
              const userInfo = userSearchData?.body.find(
                (u: User) => u.id === member.userId,
              );
              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-2 rounded border px-2 py-1"
                >
                  <div className="flex-1">
                    <span className="font-medium">
                      {userInfo?.name ?? userInfo?.email ?? member.userId}
                    </span>
                    {userInfo?.email && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {userInfo.email}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveMember(member.userId)}
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
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
