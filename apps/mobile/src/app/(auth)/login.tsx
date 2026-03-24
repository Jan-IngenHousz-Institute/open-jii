/* eslint-disable @typescript-eslint/no-require-imports */
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { OTPInput } from "~/components/OTPInput";
import { useIsOnline } from "~/hooks/use-is-online";
import { useLoginFlow } from "~/hooks/use-login";
import { useMultiTapReveal } from "~/hooks/use-multi-tap-reveal";
import { useTheme } from "~/hooks/use-theme";
import { prefetchOfflineData } from "~/services/prefetch-offline-data";
import { getEnvVar } from "~/stores/environment-store";
import { EnvironmentSelector } from "~/widgets/environment-selector";

import { GitHubIcon, OrcidIcon } from "./components/oauth-icons";
import { OfflineBanner } from "./components/offline-banner";

const RESEND_COOLDOWN_SECONDS = 30;

export default function LoginScreen() {
  const theme = useTheme();
  const { colors } = theme;

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

  const { isVisible: showEnvSelector, handleTap: handleHeaderTap } = useMultiTapReveal({
    tapsRequired: 4,
    intervalMs: 600,
  });

  const [showOTPInput, setShowOTPInput] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOTP] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const handleOTPVerify = useCallback(async () => {
    setError("");
    if (otp?.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    const result = await verifyEmailOTP(email, otp);
    if (result?.error) {
      setError(
        "The code you entered is invalid or has expired. Please try again or request a new one.",
      );
      return;
    }

    void prefetchOfflineData(queryClient);
  }, [otp, email, verifyEmailOTP, queryClient]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    if (otp.length === 6 && !verifyLoading && !isOffline) {
      void handleOTPVerify();
    }
  }, [otp, verifyLoading, handleOTPVerify, isOffline]);

  async function handleGitHubLogin() {
    setError("");
    await startGitHubLogin();
    void prefetchOfflineData(queryClient);
  }

  async function handleOrcidLogin() {
    setError("");
    await startOrcidLogin();
    void prefetchOfflineData(queryClient);
  }

  async function handleEmailSubmit() {
    setError("");
    if (!email?.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    const result = await sendEmailOTP(email);
    if (result?.error) {
      setError(result.error.message ?? "Failed to send code");
      return;
    }

    setShowOTPInput(true);
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleResendCode() {
    if (emailLoading || countdown > 0) return;

    setError("");
    const result = await sendEmailOTP(email);
    if (result?.error) {
      setError(result.error.message ?? "Failed to resend code");
      return;
    }

    setOTP("");
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  function handleEditEmail() {
    setShowOTPInput(false);
    setOTP("");
    setError("");
  }

  const textColor = theme.isDark ? colors.dark.onSurface : colors.light.onSurface;
  const mutedColor = theme.isDark ? colors.dark.inactive : colors.light.inactive;

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.isDark ? colors.dark.background : colors.light.background },
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Pressable onPress={handleHeaderTap} hitSlop={10}>
              <Image source={require("../../../assets/splash-icon.png")} style={styles.logo} />
            </Pressable>
            <Text style={[styles.appName, { color: textColor }]}>openJII</Text>
            <Text style={[styles.tagline, { color: mutedColor }]}>Sensor Data Collection</Text>
          </View>

          <View style={styles.formContainer}>
            {showEnvSelector && <EnvironmentSelector />}
            {isOffline && <OfflineBanner />}

            {!showOTPInput ? (
              <>
                <Text style={[styles.loginTitle, { color: textColor }]}>Log in or sign up</Text>

                <Text style={[styles.fieldLabel, { color: textColor }]}>Email address</Text>
                <Input
                  placeholder="Enter your email..."
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!emailLoading && !isOffline}
                  error={error}
                  containerStyle={{ marginBottom: 12 }}
                />
                <Button
                  title="Continue with Email"
                  variant="primary"
                  onPress={handleEmailSubmit}
                  style={styles.authButton}
                  isDisabled={emailLoading || isOffline}
                  isLoading={emailLoading}
                />

                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={[styles.dividerText, { color: mutedColor }]}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.providersGrid}>
                  <Button
                    title="GitHub"
                    variant="surface"
                    onPress={handleGitHubLogin}
                    isDisabled={githubLoading || isOffline}
                    isLoading={githubLoading}
                    icon={<GitHubIcon />}
                    style={styles.providerButton}
                  />
                  <Button
                    title="ORCID"
                    variant="surface"
                    onPress={handleOrcidLogin}
                    isDisabled={orcidLoading || isOffline}
                    isLoading={orcidLoading}
                    icon={<OrcidIcon />}
                    style={styles.providerButton}
                  />
                </View>

                <Text style={[styles.termsText, { color: mutedColor }]}>
                  By continuing you accept the{" "}
                  <Text
                    style={[styles.termsLink, { color: "#005e5e" }]}
                    onPress={() => void Linking.openURL(`${webBaseUrl}/terms-and-conditions`)}
                  >
                    terms and conditions
                  </Text>
                </Text>
              </>
            ) : (
              <>
                <Pressable onPress={handleEditEmail} style={styles.backButton} hitSlop={10}>
                  <MaterialIcons name="arrow-back" size={24} color={textColor} />
                </Pressable>

                <Text style={[styles.loginTitle, { color: textColor }]}>
                  Check your email for a sign-in code
                </Text>
                <Text style={[styles.helperText, { color: mutedColor }]}>
                  Please enter the 6-digit code we sent to{" "}
                  <Text style={[styles.emailLink, { color: "#005e5e" }]} onPress={handleEditEmail}>
                    {email}
                  </Text>{" "}
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color="#005e5e"
                    onPress={handleEditEmail}
                    style={{ marginLeft: 4 }}
                  />
                </Text>
                <OTPInput
                  value={otp}
                  onChangeText={setOTP}
                  length={6}
                  editable={!verifyLoading && !isOffline}
                  autoFocus
                  error={!!error}
                />
                {error ? (
                  <Text style={[styles.errorText, { color: "#dc2626" }]}>{error}</Text>
                ) : null}

                <Pressable
                  onPress={handleResendCode}
                  disabled={countdown > 0 || emailLoading || isOffline}
                  style={styles.resendButton}
                >
                  <Text
                    style={[
                      styles.resendText,
                      {
                        color: countdown > 0 || emailLoading || isOffline ? mutedColor : "#005e5e",
                      },
                    ]}
                  >
                    {countdown > 0 ? `Re-send code (${countdown}s)` : "Re-send code"}
                  </Text>
                </Pressable>
              </>
            )}

            {(githubLoading || orcidLoading || emailLoading || verifyLoading) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.isDark ? "#fff" : "#000"} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "flex-start", paddingTop: 48, padding: 24 },
  logoContainer: { alignItems: "center", marginTop: 0, marginBottom: 48 },
  logo: { width: 100, height: 100, borderRadius: 20 },
  appName: { fontSize: 28, fontWeight: "bold", marginTop: 16 },
  tagline: { fontSize: 16, marginTop: 8 },
  formContainer: { width: "100%" },
  loginTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  authButton: { marginBottom: 12 },
  providersGrid: { flexDirection: "column", gap: 12, marginBottom: 12 },
  providerButton: { marginBottom: 0 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  dividerText: { marginHorizontal: 12, fontSize: 14, fontWeight: "500" },
  helperText: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  emailLink: { fontWeight: "600", textDecorationLine: "underline" },
  resendButton: { marginTop: 20, marginBottom: 16, alignSelf: "flex-start" },
  resendText: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 14, marginTop: 8, marginBottom: 8 },
  loadingContainer: { marginTop: 16, alignItems: "center" },
  termsText: { fontSize: 12, marginTop: 24, lineHeight: 18 },
  termsLink: { fontWeight: "600", textDecorationLine: "underline" },
  backButton: { marginBottom: 16, alignSelf: "flex-start" },
});
