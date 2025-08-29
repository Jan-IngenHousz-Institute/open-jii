"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

import type { Session } from "@repo/auth/types";
import { Form, Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { ErrorDisplay } from "../error-display";
import { ProfileCard } from "./profile-card";
import { ProfilePictureCard } from "./profile-picture-card";

interface AccountSettingsValues {
  firstName: string;
  lastName: string;
  bio: string;
  organization: string;
}

export function AccountSettings({ session }: { session: Session | null }) {
  const user = session?.user as
    | { id: string; email: string; name?: string | null; image?: string | null }
    | undefined;

  // Fetch existing user profile data
  const {
    data: userProfile,
    isLoading: isLoadingProfile,
    error,
  } = useGetUserProfile(user?.id ?? "");

  // 1) Loading gate
  if (isLoadingProfile) {
    return <div>Loading account settings...</div>;
  }

  // 2) Error gate
  if (error) {
    return <ErrorDisplay error={error} title="Error loading account settings" />;
  }

  // 3) Compute initial values once (profile -> fallback to auth name -> empty)
  const initialValues: AccountSettingsValues = userProfile?.body
    ? {
        firstName: userProfile.body.firstName,
        lastName: userProfile.body.lastName,
        bio: userProfile.body.bio ?? "",
        organization: userProfile.body.organization ?? "",
      }
    : (() => {
        const nameParts = (user?.name ?? "").trim().split(/\s+/).filter(Boolean);
        return {
          firstName: nameParts[0] ?? "",
          lastName: nameParts.slice(1).join(" "),
          bio: "",
          organization: "",
        };
      })();

  return <AccountSettingsInner initialValues={initialValues} />;
}

// A pure, dumb form component that never fetches nor resets.
// It mounts once with the right defaults and composes the new cards.
function AccountSettingsInner({ initialValues }: { initialValues: AccountSettingsValues }) {
  const router = useRouter();

  const { mutate: createUserProfile, isPending } = useCreateUserProfile({
    onSuccess: () => {
      toast({ description: "Account settings saved" });
    },
  });

  const form = useForm<AccountSettingsValues>({
    defaultValues: initialValues,
  });

  function onCancel() {
    router.back();
  }

  function isEmptyOrWhitespace(str: string | undefined | null): boolean {
    return !str || str.trim().length === 0;
  }

  function onSubmit(values: AccountSettingsValues) {
    if (isEmptyOrWhitespace(values.firstName) || isEmptyOrWhitespace(values.lastName)) {
      toast({ description: "First name and last name are required.", variant: "destructive" });
      return;
    }
    createUserProfile({
      body: {
        firstName: values.firstName,
        lastName: values.lastName,
        bio: values.bio,
        organization: values.organization,
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Two-column layout: picture card on the left, profile card on the right */}
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          <div className="h-full">
            <ProfilePictureCard />
          </div>
          <div className="h-full">
            <ProfileCard form={form} />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-2">
          <Button type="button" onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
