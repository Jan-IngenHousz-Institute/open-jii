"use client";

import { useState } from "react";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";
import { parseApiError } from "~/util/apiError";

import type { CreateUserProfileBody, User } from "@repo/api/domains/user/user.schema";
import type { Session } from "@repo/auth/types";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { ErrorDisplay } from "../error-display";
import { AccountIdentityCard } from "./account-identity-card";
import { DangerZoneCard } from "./danger-zone/danger-zone-card";
import { ProfileInformationCard } from "./profile-information-card";

export function AccountSettings({ session }: { session: Session | null }) {
  const { t } = useTranslation("account");
  const user = session?.user as User | undefined;

  const {
    data: userProfile,
    isLoading: isLoadingProfile,
    error,
  } = useGetUserProfile(user?.id ?? "");

  if (isLoadingProfile) {
    return <div>{t("settings.loading")}</div>;
  }

  if (error) {
    return <ErrorDisplay error={error} title={t("settings.errorTitle")} />;
  }

  const initialValues: CreateUserProfileBody = userProfile
    ? {
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        bio: userProfile.bio ?? "",
        organization: userProfile.organization ?? "",
        activated: userProfile.activated ?? true,
        avatarUrl: userProfile.avatarUrl ?? user?.image ?? null,
      }
    : {
        firstName: "",
        lastName: "",
        bio: "",
        organization: "",
        activated: true,
        avatarUrl: user?.image ?? null,
      };

  return (
    <AccountSettingsContent
      initialValues={initialValues}
      userId={user?.id ?? ""}
      email={user?.email ?? null}
    />
  );
}

function AccountSettingsContent({
  initialValues,
  userId,
  email,
}: {
  initialValues: CreateUserProfileBody;
  userId: string;
  email?: string | null;
}) {
  const { t } = useTranslation("account");
  const [profile, setProfile] = useState(initialValues);
  const { mutateAsync: updateProfile, isPending } = useCreateUserProfile({
    onSuccess: () => {
      toast({ description: t("settings.saved") });
    },
  });

  const saveProfile = async (nextProfile: CreateUserProfileBody) => {
    try {
      await updateProfile(nextProfile);
      setProfile(nextProfile);
    } catch (err) {
      toast({
        description: parseApiError(err)?.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const saveName = async (displayName: string) => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") || profile.lastName;

    if (firstName.length < 2 || lastName.length < 2) {
      toast({
        description: t("settings.ProfileInformationCard.nameValidation"),
        variant: "destructive",
      });
      return;
    }

    await saveProfile({ ...profile, firstName, lastName });
  };

  const saveAvatarUrl = async (avatarUrl: string) => {
    const trimmedUrl = avatarUrl.trim();
    await saveProfile({ ...profile, avatarUrl: trimmedUrl || null });
  };

  const saveBio = async (bio: string) => {
    await saveProfile({ ...profile, bio });
  };

  const saveOrganization = async (organization: string) => {
    await saveProfile({ ...profile, organization: organization.trim() });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <AccountIdentityCard
        profile={profile}
        email={email}
        onSaveName={saveName}
        onSaveAvatarUrl={saveAvatarUrl}
        isPending={isPending}
      />
      <ProfileInformationCard
        profile={profile}
        onSaveBio={saveBio}
        onSaveOrganization={saveOrganization}
        isPending={isPending}
      />
      <DangerZoneCard profile={profile} userId={userId} />
    </div>
  );
}
