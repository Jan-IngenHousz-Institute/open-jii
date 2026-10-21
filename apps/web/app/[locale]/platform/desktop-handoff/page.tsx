"use client";

import { env } from "~/env";
import { useState } from "react";

import { authClient, useSession } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

// Signed in here in the browser: once the researcher confirms, mint a short-lived token and hand it to the desktop app.
export default function DesktopHandoffPage() {
  const { data: session } = useSession();
  const [appLink, setAppLink] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [declined, setDeclined] = useState(false);

  const isWaitingForChoice = appLink === null && !failed && !declined;

  function handOff() {
    void fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/one-time-token/generate`, {
      credentials: "include",
    })
      .then((response) => response.json())
      .then(({ token }: { token: string }) => {
        const link = `openjii://auth?token=${encodeURIComponent(token)}`;
        setAppLink(link);
        window.location.href = link;
      })
      .catch(() => setFailed(true));
  }

  function switchAccount() {
    const here = `${window.location.pathname}${window.location.search}`;
    void authClient.signOut().then(() => {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(here)}`;
    });
  }

  return (
    <div className="mx-auto mt-24 max-w-md space-y-4 text-center" data-testid="desktop-handoff">
      <h1 className="text-2xl font-semibold">Sign in to the openJII desktop app?</h1>
      {isWaitingForChoice ? (
        <>
          <p className="text-muted-foreground">
            The app on this computer asked to sign in as {session?.user.email}. Continue only if
            you just selected Continue in browser in the app.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setDeclined(true)}>
              Cancel
            </Button>
            <Button onClick={handOff} data-testid="desktop-handoff-confirm">
              Sign in to the app
            </Button>
          </div>
          <button type="button" className="text-primary text-sm underline" onClick={switchAccount}>
            Use another account
          </button>
        </>
      ) : null}
      {declined ? <p className="text-muted-foreground">Nothing was shared. You can close this tab.</p> : null}
      {failed ? (
        <p className="text-muted-foreground">Could not create a sign-in link. Try again from the app.</p>
      ) : null}
      {appLink ? (
        <>
          <p className="text-muted-foreground">
            Your browser may ask to open openJII. You can close this tab afterwards.
          </p>
          <a className="text-primary underline" href={appLink} data-testid="desktop-app-link">
            Open the openJII app
          </a>
        </>
      ) : null}
    </div>
  );
}
