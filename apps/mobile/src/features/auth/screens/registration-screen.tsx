import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { sendEmailLoginOtp, verifyEmailLoginOtp } from "~/features/auth/api/login.api";
import type {
  RegistrationFieldError,
  RegistrationFormValues,
} from "~/features/auth/domain/registration-form";
import { isValidEmail, validateRegistration } from "~/features/auth/domain/registration-form";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useRegistration } from "~/features/auth/hooks/use-registration";
import { useSession } from "~/features/auth/hooks/use-session";
import { reloadSessionFromServer } from "~/features/auth/services/auth";
import { useTranslation } from "~/shared/i18n";
import { createLogger } from "~/shared/observability/logger";
import { getEnvVar } from "~/shared/stores/environment-store";
import { Button } from "~/shared/ui/Button";
import { Checkbox } from "~/shared/ui/Checkbox";
import { Input } from "~/shared/ui/Input";
import { OTPInput } from "~/shared/ui/OTPInput";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

const log = createLogger("registration");

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

// Better Auth error codes that mean the person typed a wrong or stale code.
const WRONG_CODE_ERRORS = new Set(["INVALID_OTP", "OTP_EXPIRED"]);

const FIELD_ERROR_KEYS: Record<RegistrationFieldError, string> = {
  email: "auth:errors.invalidEmail",
  firstName: "auth:registration.firstNameError",
  lastName: "auth:registration.lastNameError",
  acceptedTerms: "auth:registration.acceptTermsError",
};

export default function RegistrationScreen() {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["common", "auth"]);
  const { user } = useSession();
  const logout = useLogout();
  const registration = useRegistration();
  const webBaseUrl = getEnvVar("NEXT_AUTH_URI");

  // ORCID accounts without a public email carry the ORCID iD in the email column.
  const needsEmail = !isValidEmail(user?.email);

  const [values, setValues] = useState<RegistrationFormValues>({
    email: "",
    firstName: "",
    lastName: "",
    acceptedTerms: false,
    newsletterOptIn: false,
  });
  const [errors, setErrors] = useState<Partial<Record<RegistrationFieldError, string>>>({});
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  // A verified code is spent, so a retry after a failed profile save must not verify it again.
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const isBusy = isWorking || registration.isPending;
  // Better Auth stores emails lowercased; the sign-in hook writes this value as given.
  const email = values.email.trim().toLowerCase();

  // The session cookie can say unregistered for a day after registering on the web or another
  // phone, so the database decides each time this screen opens or the app returns.
  useEffect(() => {
    const recheck = () => void reloadSessionFromServer().catch(() => undefined);
    recheck();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") recheck();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function update<K extends keyof RegistrationFormValues>(
    key: K,
    value: RegistrationFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function register() {
    await registration.mutateAsync({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      avatarUrl: user?.image ?? null,
      newsletterOptIn: values.newsletterOptIn,
    });
  }

  async function onSubmit() {
    if (isBusy) return;
    const fieldErrors = validateRegistration(values, { needsEmail });
    if (fieldErrors.length > 0) {
      setErrors(
        Object.fromEntries(fieldErrors.map((field) => [field, t(FIELD_ERROR_KEYS[field])])),
      );
      return;
    }

    setIsWorking(true);
    try {
      if (needsEmail) {
        const sendError = await sendCode();
        if (sendError) {
          setErrors({ email: sendError });
          return;
        }
        setOtp("");
        setOtpError(undefined);
        setStep("otp");
        return;
      }
      await register();
    } catch {
      // useRegistration reports its own failure.
    } finally {
      setIsWorking(false);
    }
  }

  /** Returns a message to show when the code could not be sent. */
  async function sendCode(): Promise<string | undefined> {
    try {
      const result = await sendEmailLoginOtp(email);
      if (result?.error) return result.error.message ?? t("auth:errors.sendFailed");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      return undefined;
    } catch (error) {
      log.warn("registration code send failed", { err: (error as Error)?.message });
      return t("auth:errors.sendFailed");
    }
  }

  async function onResend() {
    if (isBusy || resendIn > 0) return;
    setIsWorking(true);
    setOtp("");
    setOtpError(await sendCode());
    setIsWorking(false);
  }

  async function verifyAndRegister(code: string) {
    if (isBusy) return;
    setIsWorking(true);
    let verified = emailVerified;
    try {
      if (!verified) {
        const result = await verifyEmailLoginOtp({ email, code });
        if (result?.error) {
          setOtpError(
            WRONG_CODE_ERRORS.has(result.error.code ?? "")
              ? t("auth:errors.expiredOtp")
              : (result.error.message ?? t("auth:errors.verifyFailed")),
          );
          return;
        }
        verified = true;
        setEmailVerified(true);
      }
      await register();
    } catch {
      // A thrown verify call lands here unverified; useRegistration reports a failed save.
      if (!verified) setOtpError(t("auth:errors.verifyFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  function onOtpChange(code: string) {
    setOtp(code);
    setOtpError(undefined);
    if (code.length === OTP_LENGTH) void verifyAndRegister(code);
  }

  const submitTitle = needsEmail
    ? t("auth:registration.continueWithEmailVerification")
    : t("auth:registration.register");

  return (
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: 48, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {step === "form" ? (
            <>
              <Text className="text-on-surface mb-2 text-2xl font-bold">
                {t("auth:registration.title")}
              </Text>
              <Text className="text-inactive mb-6 text-sm leading-5">
                {t("auth:registration.description")}
              </Text>

              {needsEmail ? (
                <Input
                  label={t("auth:registration.email")}
                  placeholder={t("auth:emailPlaceholder")}
                  value={values.email}
                  onChangeText={(text) => update("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isBusy}
                  error={errors.email}
                  helper={t("auth:registration.emailDescription")}
                  accessibilityLabel={t("auth:registration.email")}
                />
              ) : null}

              <Input
                label={t("auth:registration.firstName")}
                placeholder={t("auth:registration.firstNamePlaceholder")}
                value={values.firstName}
                onChangeText={(text) => update("firstName", text)}
                autoCapitalize="words"
                autoComplete="given-name"
                editable={!isBusy}
                error={errors.firstName}
                accessibilityLabel={t("auth:registration.firstName")}
              />
              <Input
                label={t("auth:registration.lastName")}
                placeholder={t("auth:registration.lastNamePlaceholder")}
                value={values.lastName}
                onChangeText={(text) => update("lastName", text)}
                autoCapitalize="words"
                autoComplete="family-name"
                editable={!isBusy}
                error={errors.lastName}
                accessibilityLabel={t("auth:registration.lastName")}
              />

              <View className="mb-2 mt-2">
                <Checkbox
                  value={values.acceptedTerms}
                  onChange={(checked) => update("acceptedTerms", checked)}
                  text={t("auth:registration.acceptTerms")}
                  textSize="sm"
                />
              </View>
              <Text
                className="text-jii-primary mb-2 ml-8 text-sm font-semibold underline"
                onPress={() => void Linking.openURL(`${webBaseUrl}/terms-and-conditions`)}
              >
                {t("auth:registration.readTerms")}
              </Text>
              {errors.acceptedTerms ? (
                <Text className="text-destructive mb-2 text-xs">{errors.acceptedTerms}</Text>
              ) : null}

              <View className="mb-6 mt-2">
                <Checkbox
                  value={values.newsletterOptIn}
                  onChange={(checked) => update("newsletterOptIn", checked)}
                  text={t("auth:registration.newsletterOptIn")}
                  textSize="sm"
                />
              </View>

              <Button
                title={submitTitle}
                variant="primary"
                onPress={() => void onSubmit()}
                isDisabled={isBusy}
                isLoading={isBusy}
              />
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setStep("form")}
                className="mb-4 self-start"
                hitSlop={10}
                disabled={isBusy || emailVerified}
                accessibilityRole="button"
                accessibilityLabel={t("auth:registration.back")}
              >
                <MaterialIcons name="arrow-back" size={24} color={themeColors.onSurface} />
              </Pressable>
              <Text className="text-on-surface mb-4 text-2xl font-bold">
                {t("auth:checkEmailTitle")}
              </Text>
              <Text className="text-inactive mb-5 text-sm leading-5">
                {t("auth:otpHelper")}
                <Text className="text-on-surface font-semibold">{email}</Text>
              </Text>
              <OTPInput
                value={otp}
                onChangeText={onOtpChange}
                length={OTP_LENGTH}
                editable={!isBusy && !emailVerified}
                autoFocus
                error={!!otpError}
              />
              {otpError ? <Text className="text-destructive mt-2 text-sm">{otpError}</Text> : null}
              {emailVerified ? null : (
                <Pressable
                  onPress={() => void onResend()}
                  disabled={isBusy || resendIn > 0}
                  className="mt-5 self-start"
                  accessibilityRole="button"
                >
                  <Text
                    className={`text-sm font-semibold ${
                      isBusy || resendIn > 0 ? "text-inactive" : "text-jii-primary"
                    }`}
                  >
                    {resendIn > 0
                      ? t("auth:resendCodeCountdown", { seconds: resendIn })
                      : t("auth:resendCode")}
                  </Text>
                </Pressable>
              )}
              <Button
                title={
                  emailVerified
                    ? t("auth:registration.register")
                    : t("auth:registration.verifyAndRegister")
                }
                variant="primary"
                onPress={() => void verifyAndRegister(otp)}
                isDisabled={isBusy || otp.length !== OTP_LENGTH}
                isLoading={isBusy}
                style={{ marginTop: 20 }}
              />
            </>
          )}

          <Pressable
            onPress={() => void logout()}
            disabled={isBusy}
            className="mt-8 self-center"
            hitSlop={10}
          >
            <Text className="text-inactive text-sm font-semibold underline">
              {t("auth:registration.signOut")}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
