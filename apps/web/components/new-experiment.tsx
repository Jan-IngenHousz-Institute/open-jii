"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { useUserSearch } from "@/hooks/useUserSearch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody, User } from "@repo/api";
import { zCreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button, Form } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useDebounce } from "../hooks/useDebounce";
import { NewExperimentDetailsCard } from "./new-experiment-details-card";
import { NewExperimentMembersCard } from "./new-experiment-members-card";
import { NewExperimentVisibilityCard } from "./new-experiment-visibility-card";

export function NewExperimentForm() {
  const router = useRouter();
  const { t } = useTranslation(undefined, "common");
  const locale = useLocale();

  const { mutate: createExperiment, isPending } = useExperimentCreate({
    onSuccess: () => {
      toast({
        description: t("experiments.experimentCreated"),
      });
      // Navigate to the experiment page with locale
      router.push(`/${locale}/platform/experiments`);
    },
  });

  const form = useForm<CreateExperimentBody>({
    resolver: zodResolver(zCreateExperimentBody),
    defaultValues: {
      name: "",
      description: "",
      visibility: zExperimentVisibility.enum.public,
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
  // Track added users for display
  const [addedUsers, setAddedUsers] = useState<User[]>([]);
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? "";

  // Use form for members instead of useState
  const watchedMembers = form.watch("members");
  const members = useMemo(() => watchedMembers ?? [], [watchedMembers]);
  // Filter available users (exclude already added and current user)
  const availableUsers = useMemo(
    () =>
      userSearchData?.body.filter(
        (user: User) =>
          !members.some((m) => m.userId === user.id) &&
          user.id !== currentUserId,
      ) ?? [],
    [userSearchData, members, currentUserId],
  );

  const adminCount = useMemo(() => {
    return members.filter((m) => m.role === "admin").length;
  }, [members]);

  // Add member handler
  const handleAddMember = (userId: string): Promise<void> => {
    const user = availableUsers.find((u) => u.id === userId);
    if (!user) return Promise.resolve();
    form.setValue("members", [
      ...members,
      { userId: user.id, role: "member" as const },
    ]);
    setAddedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev : [...prev, user],
    );
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

  // Helper to get user info from addedUsers, then userSearchData, then fallback
  const getUserInfo = (member: { userId: string }): User => {
    const found = addedUsers.find((u) => u.id === member.userId);
    if (found) return found;
    const foundSearch = userSearchData?.body.find(
      (u: User) => u.id === member.userId,
    );
    if (foundSearch) return foundSearch;
    return {
      id: member.userId,
      name: "Loading user info...",
      email: "",
      emailVerified: null,
      image: null,
      createdAt: "",
    };
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Card 1: Name & Description */}
        <NewExperimentDetailsCard form={form} />
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Card 2: Add Members */}
          <NewExperimentMembersCard
            form={form}
            availableUsers={availableUsers}
            selectedUserId={selectedUserId}
            setSelectedUserId={setSelectedUserId}
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            isDebounced={isDebounced}
            isFetchingUsers={isFetchingUsers}
            handleAddMember={handleAddMember}
            members={members}
            getUserInfo={getUserInfo}
            handleRemoveMember={handleRemoveMember}
            adminCount={adminCount}
          />
          {/* Card 3: Visibility & Embargo */}
          <NewExperimentVisibilityCard form={form} />
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={cancel} variant="outline">
            {t("newExperiment.cancel")}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t("newExperiment.creating")
              : t("newExperiment.finalizeSetup")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
