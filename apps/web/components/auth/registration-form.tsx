"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useSignInEmail } from "~/hooks/auth/useSignInEmail/useSignInEmail";
import { useUpdateUser } from "~/hooks/auth/useUpdateUser/useUpdateUser";
import { useVerifyEmail } from "~/hooks/auth/useVerifyEmail/useVerifyEmail";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Form } from "@repo/ui/components/form";
import { toast } from "@repo/ui/hooks/use-toast";

import { RegistrationFields } from "./registration-fields";
import { RegistrationOtpVerification } from "./registration-otp-verification";

export interface Registration {
  firstName?: string;
  lastName?: string;
  organization?: string;
  email?: string;
  acceptedTerms?: boolean;
  otp?: string;
}

export function RegistrationForm({
  callbackUrl,
  termsData,
  userEmail,
  emailOnly = false,
}: {
  callbackUrl?: string;
  termsData: { title: React.ReactNode; content: React.ReactNode };
  userEmail?: string;
  emailOnly?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const updateUser = useUpdateUser();
  const sendOtpRegistration = useSignInEmail();
  const verifyOtpRegistration = useVerifyEmail();

  const isValidEmailCheck = z.string().email().safeParse(userEmail).success;
  const needsEmailVerification = !isValidEmailCheck;
  const OTP_LENGTH = 6;

  const registrationSchema = z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      organization: z.string().optional(),
      email: z.string().optional(),
      acceptedTerms: z.boolean().optional(),
      otp: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const addIssue = (path: string, message: string) =>
        ctx.addIssue({ code: "custom", message, path: [path] });

      if (emailOnly) {
        if (!data.email) addIssue("email", t("auth.emailRequired"));
        else if (!z.string().email().safeParse(data.email).success)
          addIssue("email", t("registration.emailInvalid"));
      } else {
        if (!data.firstName || data.firstName.length < 2)
          addIssue("firstName", t("registration.firstNameError"));
        if (!data.lastName || data.lastName.length < 2)
          addIssue("lastName", t("registration.lastNameError"));
        if (!isValidEmailCheck) {
          if (!data.email) addIssue("email", t("auth.emailRequired"));
          else if (!z.string().email().safeParse(data.email).success)
            addIssue("email", t("registration.emailInvalid"));
        }
        if (!data.acceptedTerms) addIssue("acceptedTerms", t("registration.acceptTermsError"));
      }

      if (showOTPInput && data.otp?.length !== OTP_LENGTH) addIssue("otp", t("auth.otpError"));
    });

  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      email: "",
      acceptedTerms: false,
      otp: "",
    },
  });

  const completeRegistration = async () => {
    const res = await updateUser.mutateAsync({ registered: true });

    if (res.error) {
      toast({ description: t("registration.errorMessage") || "Registration failed" });
      setIsPending(false);
      return;
    }

    toast({ description: t("registration.successMessage") });
    router.push(callbackUrl ?? "/platform");
  };

  const { mutateAsync: createUserProfile } = useCreateUserProfile({
    onSuccess: completeRegistration,
  });

  useEffect(() => {
    if (!showOTPInput) return;
    form.setValue("otp", "");
  }, [form, showOTPInput]);

  function handleEditEmail() {
    setShowOTPInput(false);
    form.setValue("otp", "");
  }

  async function onSubmit(data: Registration) {
    if (isPending) return;
    setIsPending(true);

    try {
      // User needs to verify an email address and hasn't entered the OTP yet
      if (needsEmailVerification && data.email && !showOTPInput) {
        const otpRes = await sendOtpRegistration.mutateAsync(data.email);

        if (otpRes.error) {
          form.setError("email", {
            type: "manual",
            message: otpRes.error.message,
          });
          return;
        }

        setPendingEmail(data.email);
        setShowOTPInput(true);
        return;
      }

      // User has entered OTP, verify it.
      if (needsEmailVerification && showOTPInput && data.otp) {
        const result = await verifyOtpRegistration.mutateAsync({
          email: pendingEmail,
          code: data.otp,
        });

        if (result.error) {
          form.setError("otp", {
            type: "manual",
            message: result.error.message,
          });
          return;
        }

        // Profile already exists, just re-mark as registered.
        if (emailOnly) {
          await completeRegistration();
          return;
        }
      }

      await createUserProfile({
        body: {
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          organization: data.organization,
        },
      });
    } catch {
      toast({ description: t("registration.errorMessage") || "Registration failed" });
    } finally {
      setIsPending(false);
    }
  }
  return (
    <div className="bg-card text-card-foreground ring-border flex h-full min-h-[600px] w-full flex-col rounded-2xl p-6 shadow-lg ring-1 md:p-14">
      {/* Title */}
      {!showOTPInput && (
        <div className="mb-4 text-left">
          <h1 className="text-2xl font-bold">
            {emailOnly ? t("registration.emailOnlyTitle") : t("registration.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {emailOnly ? t("registration.emailOnlyDescription") : t("registration.description")}
          </p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {needsEmailVerification && showOTPInput && (
            <RegistrationOtpVerification
              form={form}
              pendingEmail={pendingEmail}
              isPending={isPending}
              setIsPending={setIsPending}
              onEditEmail={handleEditEmail}
              onComplete={() => form.handleSubmit(onSubmit)()}
              OTP_LENGTH={OTP_LENGTH}
            />
          )}

          {!showOTPInput && (
            <RegistrationFields
              form={form}
              isPending={isPending}
              needsEmailVerification={needsEmailVerification}
              termsData={termsData}
              emailOnly={emailOnly}
            />
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary-light active:bg-primary-dark h-12 w-full rounded-xl"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("registration.registering")}
              </>
            ) : needsEmailVerification && !showOTPInput ? (
              t("registration.continueWithEmailVerification")
            ) : needsEmailVerification && showOTPInput ? (
              t("registration.verifyAndRegister")
            ) : (
              t("registration.register")
            )}
          </Button>
        </form>
      </Form>

      <div className="flex-1" />
    </div>
  );
}
