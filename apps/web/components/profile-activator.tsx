"use client";

import { useEffect, useRef } from "react";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";
import { useGetUserProfile } from "~/hooks/profile/useGetUserProfile/useGetUserProfile";

import { useSession } from "@repo/auth/client";

/**
 * ProfileActivator component handles reactivating deactivated user profiles on sign-in.
 */
export function ProfileActivator() {
  const { data: session, status } = useSession();
  const userId = session?.user.id;
  const hasChecked = useRef(false);

  const { data: userProfileData } = useGetUserProfile(userId ?? "", !!userId);
  const profile = userProfileData?.body;

  const { mutate: updateProfile } = useCreateUserProfile({
    onSuccess: () => {
      console.log("Profile reactivated successfully on login");
    },
  });

  // Check if profile needs reactivation after successful sign-in
  useEffect(() => {
    if (status === "authenticated" && userId && profile && !hasChecked.current) {
      hasChecked.current = true;

      // If profile is deactivated, reactivate it
      if (profile.activated === false) {
        updateProfile({
          body: {
            firstName: profile.firstName,
            lastName: profile.lastName,
            activated: true,
          },
        });
      }
    }
  }, [status, userId, profile, updateProfile]);

  return null;
}
