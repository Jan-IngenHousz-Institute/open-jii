"use client";

import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "@repo/ui/components";

import type { ConsentStatus } from "../lib/cookie-consent";
import { getConsentStatus, setConsentStatus } from "../lib/cookie-consent";

export function CookieBanner() {
  const posthog = usePostHog();
  const [consentGiven, setConsentGiven] = useState<ConsentStatus | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    setConsentGiven(getConsentStatus());
  }, []);

  const handleAcceptCookies = () => {
    setConsentStatus("accepted");
    setConsentGiven("accepted");
    posthog.opt_in_capturing();
  };

  const handleDeclineCookies = () => {
    setConsentStatus("rejected");
    setConsentGiven("rejected");
    posthog.opt_out_capturing();
    posthog.reset();
  };

  const handleSavePreferences = () => {
    if (analyticsEnabled) {
      setConsentStatus("accepted");
      setConsentGiven("accepted");
      posthog.opt_in_capturing();
    } else {
      setConsentStatus("rejected");
      setConsentGiven("rejected");
      posthog.opt_out_capturing();
      posthog.reset();
    }
    setShowManage(false);
  };

  if (consentGiven === null || consentGiven !== "pending") {
    return null;
  }

  return (
    <>
      <div className="bg-card border-border fixed inset-x-0 bottom-0 z-50 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-sm sm:pr-6">
              This website uses cookies to supplement a balanced diet and provide a much deserved
              reward to the senses after consuming bland but nutritious meals. Accepting our cookies
              is optional but recommended, as they are delicious. See our{" "}
              <Link href="/cookie-policy" className="text-primary hover:underline" prefetch={false}>
                cookie policy
              </Link>
              .
            </p>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={() => setShowManage(true)}>
                Manage preferences
              </Button>
              <Button variant="outline" onClick={handleDeclineCookies}>
                Reject all
              </Button>
              <Button onClick={handleAcceptCookies}>Accept all</Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Cookie Preferences</DialogTitle>
            <DialogDescription>
              Choose which cookies you want to allow. Essential cookies are always enabled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="border-border flex items-center justify-between rounded-md border p-4">
              <div className="flex-1">
                <h4 className="text-foreground font-medium">Essential Cookies</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Required for authentication, security, and basic functionality. These cannot be
                  disabled.
                </p>
              </div>
              <div className="text-muted-foreground ml-4 text-sm font-medium">Always Active</div>
            </div>

            <div className="border-border flex items-center justify-between rounded-md border p-4">
              <div className="flex-1">
                <h4 className="text-foreground font-medium">Analytics Cookies</h4>
                <p className="text-muted-foreground mt-1 text-sm">
                  Help us understand how you use our platform to improve your experience. Powered by
                  PostHog.
                </p>
              </div>
              <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSavePreferences}>Save & Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
