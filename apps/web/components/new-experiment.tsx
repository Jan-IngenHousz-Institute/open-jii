"use client";

import { useExperimentCreate } from "@/hooks/experiment/useExperimentCreate/useExperimentCreate";
import { useLocale } from "@/hooks/useLocale";
import { useUserSearch } from "@/hooks/useUserSearch";
import { formatDate } from "@/util/date";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import type { CreateExperimentBody, User } from "@repo/api";
import { zCreateExperimentBody } from "@repo/api";
import { zExperimentVisibility } from "@repo/api";
import { useTranslation } from "@repo/i18n";
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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { useDebounce } from "../hooks/useDebounce";
import { MemberList } from "./current-members-list";
import { UserSearchWithDropdown } from "./user-search-with-dropdown";

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
        <Card>
          <CardHeader>
            <CardTitle>{t("newExperiment.detailsTitle")}</CardTitle>
            <CardDescription>
              {t("newExperiment.detailsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("newExperiment.name")}</FormLabel>
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
                  <FormLabel>{t("newExperiment.description_field")}</FormLabel>
                  <FormControl>
                    <RichTextarea
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder={t("newExperiment.description_field")}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Card 2: Add Members */}
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>{t("newExperiment.addMembersTitle")}</CardTitle>
              <CardDescription>
                {t("newExperiment.addMembersDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="mb-2">
                <UserSearchWithDropdown
                  availableUsers={availableUsers}
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  placeholder={t("newExperiment.addMemberPlaceholder")}
                  loading={!isDebounced || isFetchingUsers}
                  searchValue={userSearch}
                  onSearchChange={setUserSearch}
                  onAddUser={handleAddMember}
                  isAddingUser={false}
                />
              </div>
              <MemberList
                membersWithUserInfo={members.map((member) => ({
                  ...member,
                  role: member.role ?? "member",
                  joinedAt: new Date().toISOString(),
                  user: getUserInfo(member),
                }))}
                formatDate={formatDate}
                onRemoveMember={handleRemoveMember}
                isRemovingMember={false}
                removingMemberId={null}
                adminCount={adminCount}
              />
            </CardContent>
          </Card>
          {/* Card 3: Visibility & Embargo */}
          <Card className="min-w-0 flex-1">
            <CardHeader>
              <CardTitle>{t("newExperiment.visibilityTitle")}</CardTitle>
              <CardDescription>
                {t("newExperiment.visibilityDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("newExperiment.visibility")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              "newExperiment.visibilityPlaceholder",
                            )}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(zExperimentVisibility.enum).map(
                          (key) => {
                            return (
                              <SelectItem key={key[0]} value={key[0]}>
                                {key[0]}
                              </SelectItem>
                            );
                          },
                        )}
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
                    <FormLabel>
                      {t("newExperiment.embargoIntervalDays")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(event) =>
                          field.onChange(+event.target.value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
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
