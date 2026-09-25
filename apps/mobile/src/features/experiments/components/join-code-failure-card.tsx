import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";

/**
 * The resolve throttle's fixed window. Its `Retry-After` never reaches the oRPC
 * error, so the wait is counted from when the refusal arrived.
 */
const THROTTLE_WINDOW_MS = 60_000;

interface ThrottledCardProps {
  throttledAt: number;
  onRetry: () => void;
}

export function ThrottledCard({ throttledAt, onRetry }: ThrottledCardProps) {
  const { t } = useTranslation(["common", "experiments"]);
  const retryAt = throttledAt + THROTTLE_WINDOW_MS;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  const seconds = Math.max(0, Math.ceil((retryAt - now) / 1000));

  return (
    <FailureCard
      message={
        seconds > 0
          ? t("experiments:joinCode.tooManyCountdown", { seconds })
          : t("experiments:joinCode.tooMany")
      }
      actionLabel={t("common:retry")}
      onAction={onRetry}
      actionDisabled={seconds > 0}
    />
  );
}

interface FailureCardProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

export function FailureCard({ message, actionLabel, onAction, actionDisabled }: FailureCardProps) {
  return (
    <Card padded>
      <Text className="text-on-surface text-center text-[14px] leading-5">{message}</Text>
      {actionLabel && onAction ? (
        <View className="mt-4">
          <Button
            title={actionLabel}
            onPress={onAction}
            variant="light"
            isDisabled={actionDisabled}
          />
        </View>
      ) : null}
    </Card>
  );
}
