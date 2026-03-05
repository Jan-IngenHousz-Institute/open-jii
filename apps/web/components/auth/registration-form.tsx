"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useSendOtpRegistration } from "~/hooks/auth/useSendOtpRegistration/useSendOtpRegistration";
import { useUpdateUser } from "~/hooks/auth/useUpdateUser/useUpdateUser";
import { useVerifyOtpRegistration } from "~/hooks/auth/useVerifyOtpRegistration/useVerifyOtpRegistration";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";

import { useTranslation } from "@repo/i18n";
import { Button, Form } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import { RegistrationFields } from "./registration-fields";
import { RegistrationOtpVerification } from "./registration-otp-verification";

export interface Registration {
  firstName: string;
  lastName: string;
  organization?: string;
  email?: string;
  acceptedTerms: boolean;
  otp?: string;
}

export function RegistrationForm({
  callbackUrl,
  termsData,
  userEmail,
  userEmailVerified = false,
}: {
  callbackUrl?: string;
  termsData: { title: React.ReactNode; content: React.ReactNode };
  userEmail?: string;
  userEmailVerified?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [currentServerEmail, setCurrentServerEmail] = useState(userEmail);
  const updateUser = useUpdateUser();
  const sendOtpRegistration = useSendOtpRegistration();
  const verifyOtpRegistration = useVerifyOtpRegistration();

  const isValidEmailCheck = z.string().email().safeParse(userEmail).success;
  const needsEmail = !isValidEmailCheck;
  const needsEmailVerification = needsEmail || !userEmailVerified;
  const OTP_LENGTH = 6;

  const registrationSchema = z
    .object({
      firstName: z.string().min(2, t("registration.firstNameError")),
      lastName: z.string().min(2, t("registration.lastNameError")),
      organization: z.string().optional(),
      email: needsEmailVerification
        ? z.string().min(1, t("auth.emailRequired")).email(t("registration.emailInvalid"))
        : z.string().optional(),
      acceptedTerms: z.boolean(),
      otp: showOTPInput ? z.string().length(OTP_LENGTH, t("auth.otpError")) : z.string().optional(),
    })
    .superRefine(({ acceptedTerms }, ctx) => {
      if (!acceptedTerms) {
        ctx.addIssue({
          code: "custom",
          message: t("registration.acceptTermsError"),
          path: ["acceptedTerms"],
        });
      }
    });

  const form = useForm<Registration>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      organization: "",
      email: !needsEmail && userEmailVerified === false && userEmail ? userEmail : "", // Prefill email if available but not verified yet
      acceptedTerms: false,
      otp: "",
    },
  });

  const { mutateAsync: createUserProfile } = useCreateUserProfile({
    onSuccess: async () => {
      const res = await updateUser.mutateAsync({ registered: true });
      if (res.error) {
        toast({ description: t("registration.errorMessage") || "Registration failed" });
        setIsPending(false);
        return;
      }
      toast({ description: t("registration.successMessage") });
      router.push(callbackUrl ?? "/platform");
    },
  });

  useEffect(() => {
    if (!showOTPInput) return;
    form.setValue("otp", "");
  }, [form, showOTPInput]);

  function handleEditEmail() {
    setShowOTPInput(false);
    form.reset({
      ...form.getValues(),
      email:
        currentServerEmail && z.string().email().safeParse(currentServerEmail).success
          ? currentServerEmail
          : "",
      otp: "",
    });
  }

  async function onSubmit(data: Registration) {
    if (isPending) return;
    setIsPending(true);

    try {
      // Step 1: user needs to verify an email address and hasn't entered the OTP yet
      if (needsEmailVerification && data.email && !showOTPInput) {
        // Only update the email on the user record if it differs from what is
        // currently stored on the server
        if (data.email !== currentServerEmail) {
          const updateRes = await updateUser.mutateAsync({ email: data.email });
          if (updateRes.error) {
            form.setError("email", {
              type: "manual",
              message: updateRes.error.message,
            });
            setIsPending(false);
            return;
          }
          setCurrentServerEmail(data.email);
        } else {
          const otpRes = await sendOtpRegistration.mutateAsync(data.email);

          if (otpRes.error) {
            form.setError("email", {
              type: "manual",
              message: otpRes.error.message,
            });
            setIsPending(false);
            return;
          }
        }

        setPendingEmail(data.email);
        setShowOTPInput(true);
        setIsPending(false);
        return;
      }

      // Step 2: user has entered OTP, verify it
      if (needsEmailVerification && showOTPInput && data.otp) {
        const result = await verifyOtpRegistration.mutateAsync({
          email: pendingEmail,
          otp: data.otp,
        });
        if (result.error) {
          form.setError("otp", {
            type: "manual",
            message: result.error.message,
          });
          setIsPending(false);
          return;
        }
      }

      // Step 3: create the user profile.
      await createUserProfile({
        body: {
          firstName: data.firstName,
          lastName: data.lastName,
          organization: data.organization,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      setIsPending(false);
    }
  }

  return (
    <div className="bg-card text-card-foreground ring-border flex h-full min-h-[600px] w-full flex-col rounded-2xl p-6 shadow-lg ring-1 md:p-14">
      {/* Title */}
      {!showOTPInput && (
        <div className="mb-4 text-left">
          <h1 className="text-2xl font-bold">{t("registration.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("registration.description")}</p>
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
            />
          )}

          {!showOTPInput && (
            <RegistrationFields
              form={form}
              isPending={isPending}
              needsEmailVerification={needsEmailVerification}
              termsData={termsData}
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
              "Continue with email verification"
            ) : needsEmailVerification && showOTPInput ? (
              t("auth.verifyAndRegister", "Verify & Register")
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
