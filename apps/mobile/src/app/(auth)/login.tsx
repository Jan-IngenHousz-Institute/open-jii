import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  View,
  Text,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsOnline } from "~/hooks/use-is-online";
import { useLoginFlow } from "~/hooks/use-login";
import { useMultiTapReveal } from "~/hooks/use-multi-tap-reveal";
import { useTheme } from "~/hooks/use-theme";
import { prefetchOfflineData } from "~/services/prefetch-offline-data";
import { getEnvVar } from "~/stores/environment-store";
import { EnvironmentSelector } from "~/widgets/environment-selector";

import { EmailLoginStep } from "~/components/auth/email-login-step";
import { OfflineBanner } from "~/components/auth/offline-banner";
import { OTPVerifyStep } from "~/components/auth/otp-verify-step";

export interface LoginFormValues {
  email: string;
}

export default function LoginScreen() {
  const { classes } = useTheme();
  const queryClient = useQueryClient();
  const webBaseUrl = getEnvVar("NEXT_AUTH_URI");

  const {
    startGitHubLogin,
    startOrcidLogin,
    sendEmailOTP,
    verifyEmailOTP,
    githubLoading,
    orcidLoading,
    emailLoading,
    verifyLoading,
  } = useLoginFlow();

  const { data: online } = useIsOnline();
  const isOffline = online === false;

  const form = useForm<LoginFormValues>({ defaultValues: { email: "" } });

  const { isVisible: showEnvSelector, handleTap: handleHeaderTap } = useMultiTapReveal({
    tapsRequired: 4,
    intervalMs: 600,
  });

  const [step, setStep] = useState<"email" | "otp">("email");

  async function handleEmailSubmit(email: string) {
    const result = await sendEmailOTP(email);
    if (result?.error) throw new Error(result.error.message ?? "Failed to send code");
    setStep("otp");
  }

  async function handleOTPVerify(otp: string): Promise<string | undefined> {
    const email = form.getValues("email");
    const result = await verifyEmailOTP(email, otp);
    if (result?.error) {
      return "The code you entered is invalid or has expired. Please try again or request a new one.";
    }
    void prefetchOfflineData(queryClient);
    return undefined;
  }

  async function handleResend() {
    const email = form.getValues("email");
    const result = await sendEmailOTP(email);
    if (result?.error) throw new Error(result.error.message ?? "Failed to resend code");
  }

  async function handleGitHubLogin() {
    await startGitHubLogin();
    void prefetchOfflineData(queryClient);
  }

  async function handleOrcidLogin() {
    await startOrcidLogin();
    void prefetchOfflineData(queryClient);
  }

  const isLoading = githubLoading || orcidLoading || emailLoading || verifyLoading;

  return (
    <SafeAreaView className={clsx("flex-1", classes.background)}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: 48, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-12 items-center">
            <Pressable onPress={handleHeaderTap} hitSlop={10}>
              <Image
                source={require("../../../assets/splash-icon.png")}
                style={{ width: 100, height: 100, borderRadius: 20 }}
              />
            </Pressable>
            <Text className={clsx("mt-4 text-3xl font-bold", classes.text)}>openJII</Text>
            <Text className={clsx("mt-2 text-base", classes.textMuted)}>
              Sensor Data Collection
            </Text>
          </View>

          <View className="w-full">
            {showEnvSelector && <EnvironmentSelector />}
            {isOffline && <OfflineBanner />}

            {step === "email" ? (
              <EmailLoginStep
                form={form}
                isOffline={isOffline}
                emailLoading={emailLoading}
                githubLoading={githubLoading}
                orcidLoading={orcidLoading}
                onEmailSubmit={handleEmailSubmit}
                onGitHubLogin={handleGitHubLogin}
                onOrcidLogin={handleOrcidLogin}
                termsUrl={webBaseUrl}
              />
            ) : (
              <OTPVerifyStep
                email={form.getValues("email")}
                isOffline={isOffline}
                verifyLoading={verifyLoading}
                emailLoading={emailLoading}
                onVerify={handleOTPVerify}
                onResend={handleResend}
                onEditEmail={() => setStep("email")}
              />
            )}

            {isLoading && (
              <View className="mt-4 items-center">
                <ActivityIndicator size="small" />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
