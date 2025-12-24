"use client";

import { usePostHog } from "posthog-js/react";
import { useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ConsentStatus } from "../../../../lib/cookie-consent";
import { getConsentStatus, setConsentStatus } from "../../../../lib/cookie-consent";

/**
 * Cookie settings page component
 * Allows users to manage their cookie preferences at any time
 */
export default function CookieSettingsPage() {
  const posthog = usePostHog();
  const [consentGiven, setConsentGiven] = useState<ConsentStatus>(getConsentStatus);

  const isAccepted = consentGiven === "accepted";

  const handleToggleAnalytics = () => {
    if (isAccepted) {
      posthog.opt_out_capturing();
      posthog.reset();
      setConsentStatus("rejected");
      setConsentGiven("rejected");
      toast({ description: "Analytics cookies have been disabled." });
    } else {
      posthog.opt_in_capturing();
      setConsentStatus("accepted");
      setConsentGiven("accepted");
      toast({ description: "Analytics cookies have been enabled." });
    }
  };

  return (
    <div className="from-jii-bright-green/40 relative isolate min-h-screen overflow-hidden bg-gradient-to-br via-white to-white">
      {/* Background skew block */}
      <div
        aria-hidden="true"
        className="shadow-primary/10 ring-jii-bright-green/20 absolute inset-y-0 right-1/2 -z-10 -mr-96 w-[200%] origin-top-right skew-x-[-30deg] bg-white shadow-xl ring-1 sm:-mr-80 lg:-mr-96"
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-20">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto">
          Cookie Settings
        </h1>

        <p className="text-muted-foreground mt-4">
          Manage your cookie preferences and understand how we use cookies on our platform.
        </p>

        <div className="mt-16 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Essential Cookies</CardTitle>
              <CardDescription>
                These cookies are necessary for the website to function and cannot be disabled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Purpose:</strong> Authentication, security, session management
                </p>
                <p className="text-sm">
                  <strong>Examples:</strong> Login sessions, CSRF protection, secure connections
                </p>
                <div className="bg-muted mt-4 rounded-md p-3">
                  <p className="text-sm font-medium">Status: Always Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analytics Cookies</CardTitle>
              <CardDescription>
                These cookies help us understand how visitors interact with our website.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Purpose:</strong> Product analytics, usage tracking, feature improvement
                  </p>
                  <p className="text-sm">
                    <strong>Provider:</strong> PostHog (privacy-friendly analytics)
                  </p>
                  <p className="text-sm">
                    <strong>Data collected:</strong> Page views, button clicks, feature usage
                    patterns
                  </p>
                </div>

                <div className="bg-muted rounded-md p-3">
                  <p className="text-sm font-medium">
                    Current Status:{" "}
                    <span
                      className={
                        consentGiven === "accepted"
                          ? "text-green-600"
                          : consentGiven === "rejected"
                            ? "text-red-600"
                            : "text-yellow-600"
                      }
                    >
                      {consentGiven === "accepted"
                        ? "Enabled"
                        : consentGiven === "rejected"
                          ? "Disabled"
                          : "Not Set"}
                    </span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleToggleAnalytics}>
                    {isAccepted ? "Disable Analytics" : "Enable Analytics"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
