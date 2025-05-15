"use client";

import { Button } from "@repo/ui/components";

import { useAuthSignout } from "../hooks/auth/useAuthSignout/useAuthSignout";

// Client component to use the hook
export function ClientSignOutButton() {
  const { mutateAsync, isPending } = useAuthSignout();

  return (
    <Button
      size="lg"
      onClick={async () => {
        await mutateAsync({ body: { callbackUrl: "http://localhost:3000" } });
      }}
      disabled={isPending}
    >
      {isPending ? "Signing out..." : "Sign out (Client)"}
    </Button>
  );
}
