"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useUpdateUser } from "~/hooks/auth/useUpdateUser/useUpdateUser";
import { useCreateUserProfile } from "~/hooks/profile/useCreateUserProfile/useCreateUserProfile";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import {
  Button,
  Checkbox,
  Input,
  ScrollArea,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

const OTP_LENGTH = 6;
const REGEXP_ONLY_DIGITS_PATTERN = "^[0-9]+$";
const RESEND_COOLDOWN_SECONDS = 30;

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
  const [countdown, setCountdown] = useState(0);
  const [currentServerEmail, setCurrentServerEmail] = useState(userEmail);
  const updateUser = useUpdateUser();

  const isValidEmailCheck = z.string().email().safeParse(userEmail).success;
  const needsEmail = !isValidEmailCheck;
  const needsEmailVerification = needsEmail || !userEmailVerified;

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

  type Registration = z.infer<typeof registrationSchema>;

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
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (!showOTPInput) return;
    form.setValue("otp", "");
  }, [form, showOTPInput]);

  async function handleResendCode() {
    if (isPending || countdown > 0) return;

    setIsPending(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: pendingEmail,
        type: "email-verification",
      });

      if (res.error) {
        toast({
          description:
            res.error.message ?? t("auth.resendFailed", "Failed to resend verification code"),
        });
        return;
      }

      form.setValue("otp", "");
      setCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      console.error("Resend error:", error);
    } finally {
      setIsPending(false);
    }
  }

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
              message: updateRes.error.message ?? "Email already in use",
            });
            setIsPending(false);
            return;
          }
          setCurrentServerEmail(data.email);
        } else {
          const otpRes = await authClient.emailOtp.sendVerificationOtp({
            email: data.email,
            type: "email-verification",
          });

          if (otpRes.error) {
            form.setError("email", {
              type: "manual",
              message: otpRes.error.message ?? "Failed to send verification code",
            });
            setIsPending(false);
            return;
          }
        }

        setPendingEmail(data.email);
        setShowOTPInput(true);
        setCountdown(RESEND_COOLDOWN_SECONDS);
        setIsPending(false);
        return;
      }

      // Step 2: user has entered OTP, verify it
      if (needsEmailVerification && showOTPInput && data.otp) {
        const result = await authClient.emailOtp.verifyEmail({
          email: pendingEmail,
          otp: data.otp,
        });
        if (result.error) {
          form.setError("otp", {
            type: "manual",
            message: result.error.message ?? "Invalid verification code",
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
          {/* Email – shown when the user needs to supply or verify an email address */}
          {needsEmailVerification && !showOTPInput && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("registration.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("registration.emailPlaceholder")}
                      className="h-12 rounded-xl"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormDescription>{t("registration.emailDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {needsEmailVerification && showOTPInput && (
            <>
              <h2 className="text-xl font-bold">
                {t("auth.checkEmail", "Check your email for a sign-in code")}
              </h2>
              <div className="muted-foreground mb-4 text-sm">
                {t("auth.otpInstructions", "Please enter the 6-digit code we sent to")}{" "}
                <button
                  type="button"
                  className="inline-flex items-center font-medium text-[#005e5e] hover:underline"
                  onClick={handleEditEmail}
                  aria-label="Edit email address"
                >
                  {pendingEmail} <Pencil className="ml-1 h-3 w-3" aria-hidden="true" />
                </button>
              </div>
              <FormField
                control={form.control}
                name="otp"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormControl>
                      <InputOTP
                        maxLength={OTP_LENGTH}
                        pattern={REGEXP_ONLY_DIGITS_PATTERN}
                        containerClassName="gap-2 justify-center"
                        onComplete={() => form.handleSubmit(onSubmit)()}
                        {...field}
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: OTP_LENGTH }, (_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className={`h-12 w-12 rounded-md border text-lg ${
                                fieldState.invalid ? "border-destructive" : ""
                              }`}
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <button
                  type="button"
                  className="text-sm font-medium text-[#005e5e] hover:underline disabled:opacity-50"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || isPending}
                  aria-label={countdown > 0 ? `Resend code in ${countdown} seconds` : "Resend code"}
                >
                  {countdown > 0
                    ? `${t("auth.resendCode", "Re-send code")} (${countdown}s)`
                    : t("auth.resendCode", "Re-send code")}
                </button>
              </div>
            </>
          )}

          {/* First name */}
          {!showOTPInput && (
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("registration.firstName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("registration.firstNamePlaceholder")}
                      className="h-12 rounded-xl"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Last name */}
          {!showOTPInput && (
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("registration.lastName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("registration.lastNamePlaceholder")}
                      className="h-12 rounded-xl"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Organization */}
          {!showOTPInput && (
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("registration.organization")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("registration.organizationPlaceholder")}
                      className="h-12 rounded-xl"
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Terms */}
          {!showOTPInput && (
            <FormField
              control={form.control}
              name="acceptedTerms"
              render={({ field }) => (
                <FormItem className="flex items-end space-x-2">
                  <FormControl>
                    <Checkbox
                      id={field.name}
                      name={field.name}
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                      ref={field.ref}
                      disabled={isPending}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormLabel className="left text-sm font-medium leading-none">
                    {t("auth.termsPrefix")}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="cursor-pointer underline">
                          {t("auth.terms")}
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{termsData.title}</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-64 w-full rounded-md border p-4">
                          {termsData.content}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
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
