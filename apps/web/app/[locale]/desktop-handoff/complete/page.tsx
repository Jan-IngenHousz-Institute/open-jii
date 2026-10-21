"use client";

import { env } from "~/env";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Runs inside the desktop app: redeem the token, which sets the session cookie here.
export default function DesktopHandoffCompletePage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    void fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/one-time-token/verify`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).then((response) => {
      if (response.ok) {
        router.replace(`/${locale}/platform`);
        return;
      }
      setFailed(true);
    });
  }, [locale, router]);

  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <p className="text-muted-foreground">
        {failed ? "That sign-in link has expired. Sign in again from the app." : "Signing you in..."}
      </p>
    </div>
  );
}
