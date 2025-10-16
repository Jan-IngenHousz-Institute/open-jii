"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

import { zCreateUserProfileBody } from "@repo/api";
import type { CreateUserProfileBody } from "@repo/api";
import type { User } from "@repo/api";
import type { Session } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import { Form, Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { ErrorDisplay } from "../error-display";
import { DangerZoneCard } from "./danger-zone-card";
import { ProfileCard } from "./profile-card";
import { ProfilePictureCard } from "./profile-picture-card";

export function AccountSettings({ session }: { session: Session | null }) {
  const { t } = useTranslation("account");
  const user = session?.user as User | undefined;

  // Fetch existing user profile data
  const {
    data: userProfile,
    isLoading: isLoadingProfile,
    error,
  } = useGetUserProfile(user?.id ?? "");

  // 1) Loading gate
  if (isLoadingProfile) {
    return <div>{t("settings.loading")}</div>;
  }

  // 2) Error gate
  if (error) {
    return <ErrorDisplay error={error} title={t("settings.errorTitle")} />;
  }
  const initialValues: CreateUserProfileBody = userProfile?.body
    ? {
        firstName: userProfile.body.firstName,
        lastName: userProfile.body.lastName,
        bio: userProfile.body.bio ?? "",
        organization: userProfile.body.organization ?? "",
        activated: userProfile.body.activated ?? true,
      }
    : {
        firstName: "",
        lastName: "",
        bio: "",
        organization: "",
        activated: true,
      };

  return <AccountSettingsForm initialValues={initialValues} userId={user?.id ?? ""} />;
}

// A pure form component that mounts once with the right defaults.
function AccountSettingsForm({
  initialValues,
  userId,
}: {
  initialValues: CreateUserProfileBody;
  userId: string;
}) {
  const router = useRouter();
  const { t } = useTranslation("account");
  const { mutate: createUserProfile, isPending } = useCreateUserProfile({
    onSuccess: () => {
      toast({ description: t("settings.saved") });
    },
  });

  const form = useForm<CreateUserProfileBody>({
    resolver: zodResolver(zCreateUserProfileBody),
    defaultValues: initialValues,
    mode: "onSubmit",
  });

  function onCancel() {
    router.back();
  }

  function onSubmit(values: CreateUserProfileBody) {
    createUserProfile({ body: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">{t("settings.accountsettings")}</h3>
            <p className="text-muted-foreground text-sm">{t("settings.description")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" onClick={onCancel} variant="outline">
              {t("settings.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? t("settings.saving") : t("settings.save")}
            </Button>
          </div>
        </div>
        {/* Two-column layout: picture card on the left, profile card on the right */}
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          <div className="h-full">
            <ProfilePictureCard />
          </div>
          <div className="h-full">
            <ProfileCard form={form} />
          </div>
        </div>

        {/* Danger zone: deactivate account */}
        <div>
          <DangerZoneCard profile={initialValues} userId={userId} />
        </div>
      </form>
    </Form>
  );
}
