import { clsx } from "clsx";
import React from "react";
import { Controller } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { View, Text, Linking } from "react-native";
import { Button } from "~/components/Button";
import { Input } from "~/components/Input";
import { useTheme } from "~/hooks/use-theme";

import type { LoginFormValues } from "../login";
import { GitHubIcon, OrcidIcon } from "./oauth-icons";

interface EmailLoginStepProps {
  form: UseFormReturn<LoginFormValues>;
  isOffline: boolean;
  emailLoading: boolean;
  githubLoading: boolean;
  orcidLoading: boolean;
  onEmailSubmit: (email: string) => void;
  onGitHubLogin: () => void;
  onOrcidLogin: () => void;
  termsUrl: string;
}

export function EmailLoginStep({
  form,
  isOffline,
  emailLoading,
  githubLoading,
  orcidLoading,
  onEmailSubmit,
  onGitHubLogin,
  onOrcidLogin,
  termsUrl,
}: EmailLoginStepProps) {
  const { classes } = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  const onSubmit = (data: LoginFormValues) => onEmailSubmit(data.email);

  return (
    <>
      <Text className={clsx("mb-4 text-2xl font-bold", classes.text)}>Log in or sign up</Text>

      <Text className={clsx("mb-2 text-sm font-medium", classes.text)}>Email address</Text>
      <Controller
        control={control}
        name="email"
        rules={{
          required: "Please enter your email address",
          pattern: { value: /@/, message: "Please enter a valid email address" },
        }}
        render={({ field: { onChange, value } }) => (
          <Input
            placeholder="Enter your email..."
            value={value}
            onChangeText={onChange}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!emailLoading && !isOffline}
            error={errors.email?.message}
            containerStyle={{ marginBottom: 12 }}
          />
        )}
      />
      <Button
        title="Continue with Email"
        variant="primary"
        onPress={handleSubmit(onSubmit)}
        style={{ marginBottom: 12 }}
        isDisabled={emailLoading || isOffline}
        isLoading={emailLoading}
      />

      <View className="my-5 flex-row items-center">
        <View className="h-px flex-1 bg-gray-200" />
        <Text className={clsx("mx-3 text-sm font-medium", classes.textMuted)}>
          or continue with
        </Text>
        <View className="h-px flex-1 bg-gray-200" />
      </View>

      <View className="mb-3 gap-3">
        <Button
          title="GitHub"
          variant="surface"
          onPress={onGitHubLogin}
          isDisabled={githubLoading || isOffline}
          isLoading={githubLoading}
          icon={<GitHubIcon />}
        />
        <Button
          title="ORCID"
          variant="surface"
          onPress={onOrcidLogin}
          isDisabled={orcidLoading || isOffline}
          isLoading={orcidLoading}
          icon={<OrcidIcon />}
        />
      </View>

      <Text className={clsx("mt-6 text-xs leading-[18px]", classes.textMuted)}>
        By continuing you accept the{" "}
        <Text
          className="font-semibold underline"
          style={{ color: "#005e5e" }}
          onPress={() => void Linking.openURL(`${termsUrl}/terms-and-conditions`)}
        >
          terms and conditions
        </Text>
      </Text>
    </>
  );
}
