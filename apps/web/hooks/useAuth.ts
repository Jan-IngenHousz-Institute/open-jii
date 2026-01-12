"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";
import type { Session } from "@repo/auth/types";

/**
 * Hook to get the current session
 */
export function useSession() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<any>({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      try {
        const { data } = await authClient.getSession();
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  }) as ReturnType<typeof useQuery<Session | null>>;
}

/**
 * Hook to sign in with email (sends OTP)
 */
export function useSignInEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      // Send verification email with OTP
      const response = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (response.error) {
        throw new Error(response.error.message ?? "Failed to send verification email");
      }
      return response.data;
    },
  });
}

/**
 * Hook to verify email OTP and sign in
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await authClient.signIn.emailOtp({
        email,
        otp: code,
      });
      if (response.error) {
        throw new Error(response.error.message ?? "Invalid code");
      }
      return response.data;
    },
    onSuccess: (data) => {
      // Update session cache
      queryClient.setQueryData(["auth", "session"], data);
    },
  });
}

/**
 * Hook to sign out
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      // Clear session cache
      queryClient.setQueryData(["auth", "session"], null);
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

/**
 * Hook to get current user (shorthand)
 */
export function useUser() {
  const { data: session, ...rest } = useSession();
  return {
    user: session?.user ?? null,
    ...rest,
  };
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated() {
  const { data: session, isLoading } = useSession();
  return {
    isAuthenticated: !!session?.user,
    isLoading,
  };
}

/**
 * Hook to update user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      image?: string;
      registered?: boolean;
    }) => {
      // @ts-expect-error - registered is a custom field
      const response = await authClient.updateUser(data);
      if (response.error) {
        throw new Error(response.error.message ?? "Failed to update user");
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
