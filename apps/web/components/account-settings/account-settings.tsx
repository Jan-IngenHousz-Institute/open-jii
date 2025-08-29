"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

// ***** ONLY USING EXISTING SCHEMAS *****
import { zCreateUserProfileBody } from "@repo/api";
import type { CreateUserProfileBody } from "@repo/api";
import type { Session } from "@repo/auth/types";
import { Form, Button } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { ErrorDisplay } from "../error-display";
import { ProfileCard } from "./profile-card";
import { ProfilePictureCard } from "./profile-picture-card";

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

  const initialValues: CreateUserProfileBody = userProfile?.body
    ? {
        firstName: userProfile.body.firstName,
        lastName: userProfile.body.lastName,
        bio: userProfile.body.bio ?? "",
        organization: userProfile.body.organization ?? "",
      }
    : {
        firstName: "",
        lastName: "",
        bio: "",
        organization: "",
      };

  return <AccountSettingsInner initialValues={initialValues} />;
}

// A pure form component that mounts once with the right defaults.
function AccountSettingsInner({ initialValues }: { initialValues: CreateUserProfileBody }) {
  const router = useRouter();

  const { mutate: createUserProfile, isPending } = useCreateUserProfile({
    onSuccess: () => {
      toast({ description: "Account settings saved" });
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
