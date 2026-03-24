import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { clsx } from "clsx";
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { OTPInput } from "~/components/OTPInput";
import { useTheme } from "~/hooks/use-theme";

const RESEND_COOLDOWN_SECONDS = 30;

interface OTPVerifyStepProps {
  email: string;
  isOffline: boolean;
  verifyLoading: boolean;
  emailLoading: boolean;
  onVerify: (otp: string) => Promise<string | undefined>;
  onResend: () => Promise<void>;
  onEditEmail: () => void;
}

export function OTPVerifyStep({
  email,
  isOffline,
  verifyLoading,
  emailLoading,
  onVerify,
  onResend,
  onEditEmail,
}: OTPVerifyStepProps) {
  const { classes } = useTheme();
  const [otp, setOTP] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = useCallback(async () => {
    setError("");
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }
    const errorMessage = await onVerify(otp);
    if (errorMessage) setError(errorMessage);
  }, [otp, onVerify]);

  useEffect(() => {
    if (otp.length === 6 && !verifyLoading && !isOffline) {
      void handleVerify();
    }
  }, [otp, verifyLoading, handleVerify, isOffline]);

  async function handleResend() {
    if (emailLoading || countdown > 0) return;
    setError("");
    await onResend();
    setOTP("");
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <>
      <Pressable onPress={onEditEmail} className="mb-4 self-start" hitSlop={10}>
        <MaterialIcons name="arrow-back" size={24} className={classes.text} />
      </Pressable>

      <Text className={clsx("mb-4 text-2xl font-bold", classes.text)}>
        Check your email for a sign-in code
      </Text>
      <Text className={clsx("mb-5 text-sm leading-5", classes.textMuted)}>
        Please enter the 6-digit code we sent to{" "}
        <Text
          className="font-semibold underline"
          style={{ color: "#005e5e" }}
          onPress={onEditEmail}
        >
          {email}
        </Text>{" "}
        <MaterialIcons
          name="edit"
          size={16}
          color="#005e5e"
          onPress={onEditEmail}
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

      {error ? <Text className="mb-2 mt-2 text-sm text-red-600">{error}</Text> : null}

      <Pressable
        onPress={handleResend}
        disabled={countdown > 0 || emailLoading || isOffline}
        className="mb-4 mt-5 self-start"
      >
        <Text
          className="text-sm font-semibold"
          style={{
            color: countdown > 0 || emailLoading || isOffline ? undefined : "#005e5e",
          }}
        >
          {countdown > 0 ? `Re-send code (${countdown}s)` : "Re-send code"}
        </Text>
      </Pressable>
    </>
  );
}
