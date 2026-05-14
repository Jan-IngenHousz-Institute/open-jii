/* eslint-disable @typescript-eslint/no-require-imports */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  View,
  Text,
  SafeAreaView,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";
import { OTPInput } from "~/shared/ui/OTPInput";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";
import { useLoginFlow } from "~/features/auth/hooks/use-login";
import { useMultiTapReveal } from "~/shared/ui/hooks/use-multi-tap-reveal";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";
import { prefetchOfflineData } from "~/shared/db/prefetch-offline-data";
import { getEnvVar } from "~/shared/stores/environment-store";
import { EnvironmentSelector } from "~/features/profile/widgets/environment-selector";

const RESEND_COOLDOWN_SECONDS = 30;

interface LoginFormValues {
  email: string;
  otp: string;
}

interface OfflineBannerProps {
  online: boolean | undefined;
}

function OfflineBanner({ online }: OfflineBannerProps) {
  const { warningFg } = useThemeColors();
  if (online !== false) return null;
  return (
    <View className="mb-4 flex-row items-center gap-2 rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
      <MaterialIcons name="wifi-off" size={18} color={warningFg} />
      <Text className="flex-1 text-sm text-amber-800 dark:text-amber-200">
        You are offline. Please connect to the internet to log in.
      </Text>
    </View>
  );
}

interface OAuthIconsProps {
  onGitHubPress: () => void;
  onOrcidPress: () => void;
  githubLoading: boolean;
  orcidLoading: boolean;
  online: boolean | undefined;
}

function OAuthIcons({
  onGitHubPress,
  onOrcidPress,
  githubLoading,
  orcidLoading,
  online,
}: OAuthIconsProps) {
  const themeColors = useThemeColors();
  return (
    <View className="mb-3 flex-col gap-3">
      <Button
        title="GitHub"
        variant="surface"
        onPress={onGitHubPress}
        isDisabled={githubLoading || online === false}
        isLoading={githubLoading}
        icon={
          <Svg width="20" height="20" viewBox="0 0 24 24" fill={themeColors.onSurface}>
            <Path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </Svg>
        }
      />

      <Button
        title="ORCID"
        variant="surface"
        onPress={onOrcidPress}
        isDisabled={orcidLoading || online === false}
        isLoading={orcidLoading}
        icon={
          <Svg width="20" height="20" viewBox="0 0 24 24">
            <Path
              d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947 0 .525-.422.947-.947.947A.943.943 0 0 1 6.422 5.325c0-.516.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.016-5.325 5.016h-3.919V7.416zm1.444 1.303v7.444h2.297c2.359 0 3.588-1.313 3.588-3.722 0-2.2-1.313-3.722-3.588-3.722h-2.297z"
              fill="#A6CE39"
            />
          </Svg>
        }
      />
    </View>
  );
}

export default function LoginScreen() {
  const themeColors = useThemeColors();
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

  const { isVisible: showEnvSelector, handleTap: handleHeaderTap } = useMultiTapReveal({
    tapsRequired: 4,
    intervalMs: 600,
  });

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", otp: "" },
    mode: "onSubmit",
  });

  const email = watch("email");
  const otp = watch("otp");

  const [showOTPInput, setShowOTPInput] = React.useState(false);
  const [countdown, setCountdown] = React.useState(0);
  const [lastSubmittedOtp, setLastSubmittedOtp] = React.useState<string | null>(null);

  const formError = errors.email?.message ?? errors.otp?.message ?? "";

  const handleOTPVerify = useCallback(
    async (otpValue: string) => {
      clearErrors();
      if (otpValue.length !== 6) {
        setError("otp", { message: "Please enter a valid 6-digit code" });
        return;
      }

      const result = await verifyEmailOTP(email, otpValue);
      if (result?.error) {
        setError("otp", {
          message:
            "The code you entered is invalid or has expired. Please try again or request a new one.",
        });
        return;
      }

      void prefetchOfflineData(queryClient);
    },
    [email, verifyEmailOTP, queryClient, clearErrors, setError],
  );

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && !verifyLoading && online && otp !== lastSubmittedOtp) {
      setLastSubmittedOtp(otp);
      void handleOTPVerify(otp);
    }
  }, [otp, verifyLoading, handleOTPVerify, online, lastSubmittedOtp]);

  async function handleGitHubLogin() {
    clearErrors();
    await startGitHubLogin();
    void prefetchOfflineData(queryClient);
  }

  async function handleOrcidLogin() {
    clearErrors();
    await startOrcidLogin();
    void prefetchOfflineData(queryClient);
  }

  const onEmailSubmit = handleSubmit(async ({ email: submittedEmail }) => {
    if (!submittedEmail.includes("@")) {
      setError("email", { message: "Please enter a valid email address" });
      return;
    }

    const result = await sendEmailOTP(submittedEmail);
    if (result?.error) {
      setError("email", { message: result.error.message ?? "Failed to send code" });
      return;
    }

    setShowOTPInput(true);
    setCountdown(RESEND_COOLDOWN_SECONDS);
  });

  async function handleResendCode() {
    if (emailLoading || countdown > 0) return;

    clearErrors();
    const result = await sendEmailOTP(email);
    if (result?.error) {
      setError("email", { message: result.error.message ?? "Failed to resend code" });
      return;
    }

    setValue("otp", "");
    setLastSubmittedOtp(null);
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  function handleEditEmail() {
    setShowOTPInput(false);
    setValue("otp", "");
    setLastSubmittedOtp(null);
    clearErrors();
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "flex-start",
            paddingTop: 48,
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-12 items-center">
            <Pressable onPress={handleHeaderTap} hitSlop={10}>
              <Image
                source={require("../../../assets/splash-icon.png")}
                className="h-24 w-24 rounded-[20px]"
              />
            </Pressable>
            <Text className="text-on-surface mt-4 text-[28px] font-bold">openJII</Text>
            <Text className="text-inactive mt-2 text-base">Sensor Data Collection</Text>
          </View>

          <View className="w-full">
            {showEnvSelector && <EnvironmentSelector />}

            <OfflineBanner online={online} />

            {!showOTPInput ? (
              <>
                <Text className="text-on-surface mb-4 text-2xl font-bold">Log in or sign up</Text>

                <Text className="text-on-surface mb-2 text-sm font-medium">Email address</Text>
                <Controller
                  control={control}
                  name="email"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      placeholder="Enter your email..."
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!emailLoading && online !== false}
                      error={errors.email?.message}
                      containerStyle={{ marginBottom: 12 }}
                    />
                  )}
                />
                <Button
                  title="Continue with Email"
                  variant="primary"
                  onPress={() => void onEmailSubmit()}
                  style={{ marginBottom: 12 }}
                  isDisabled={emailLoading || online === false}
                  isLoading={emailLoading}
                />

                <View className="my-5 flex-row items-center">
                  <View className="bg-border h-px flex-1" />
                  <Text className="text-inactive mx-3 text-sm font-medium">or continue with</Text>
                  <View className="bg-border h-px flex-1" />
                </View>

                <OAuthIcons
                  onGitHubPress={() => void handleGitHubLogin()}
                  onOrcidPress={() => void handleOrcidLogin()}
                  githubLoading={githubLoading}
                  orcidLoading={orcidLoading}
                  online={online}
                />

                <Text className="text-inactive mt-6 text-xs leading-[18px]">
                  By continuing you accept the{" "}
                  <Text
                    className="text-jii-primary font-semibold underline"
                    onPress={() => void Linking.openURL(`${webBaseUrl}/terms-and-conditions`)}
                  >
                    terms and conditions
                  </Text>
                </Text>
              </>
            ) : (
              <>
                <Pressable onPress={handleEditEmail} className="mb-4 self-start" hitSlop={10}>
                  <MaterialIcons name="arrow-back" size={24} color={themeColors.onSurface} />
                </Pressable>

                <Text className="text-on-surface mb-4 text-2xl font-bold">
                  Check your email for a sign-in code
                </Text>
                <Text className="text-inactive mb-5 text-sm leading-5">
                  Please enter the 6-digit code we sent to{" "}
                  <Text
                    className="text-jii-primary font-semibold underline"
                    onPress={handleEditEmail}
                  >
                    {email}
                  </Text>{" "}
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color={themeColors.brand}
                    onPress={handleEditEmail}
                    style={{ marginLeft: 4 }}
                  />
                </Text>
                <Controller
                  control={control}
                  name="otp"
                  render={({ field: { onChange, value } }) => (
                    <OTPInput
                      value={value}
                      onChangeText={onChange}
                      length={6}
                      editable={!verifyLoading && online !== false}
                      autoFocus
                      error={!!errors.otp}
                    />
                  )}
                />
                {errors.otp?.message ? (
                  <Text className="text-destructive mb-2 mt-2 text-sm">{errors.otp.message}</Text>
                ) : null}

                <Pressable
                  onPress={() => void handleResendCode()}
                  disabled={countdown > 0 || emailLoading || online === false}
                  className="mb-4 mt-5 self-start"
                >
                  <Text
                    className={`text-sm font-semibold ${
                      countdown > 0 || emailLoading || online === false
                        ? "text-inactive"
                        : "text-jii-primary"
                    }`}
                  >
                    {countdown > 0 ? `Re-send code (${countdown}s)` : "Re-send code"}
                  </Text>
                </Pressable>
              </>
            )}

            {!!formError && !errors.email && !errors.otp && (
              <Text className="text-destructive mb-2 mt-2 text-sm">{formError}</Text>
            )}

            {(githubLoading || orcidLoading || emailLoading || verifyLoading) && (
              <View className="mt-4 items-center">
                <ActivityIndicator size="small" color={themeColors.onSurface} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
