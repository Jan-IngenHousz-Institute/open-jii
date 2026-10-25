"use client";

import { Button } from "@repo/ui/components/button";

declare global {
  interface Window {
    openjiiDesktop?: { signInWithBrowser?: () => void };
  }
}

// Scaffold: the app's bridge does not yet reach platform pages, so this button only shows the layout.
export function DesktopBrowserSignIn() {
  return (
    <div className="mb-6 space-y-2" data-testid="desktop-browser-sign-in">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => window.openjiiDesktop?.signInWithBrowser?.()}
      >
        Continue in your browser
      </Button>
      <p className="text-muted-foreground text-xs">
        For GitHub, ORCID or a passkey. Your browser signs you in and sends you back here.
      </p>
    </div>
  );
}
