"use client";

import type {
  FollowableStandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Switch } from "@repo/ui/components/switch";

import { StandardName } from "./standard-name";
import { canFollow, isFollowable } from "./use-followed-standards";

interface StandardChoiceRowProps {
  readiness: StandardReadiness;
  isFollowing: boolean;
  onToggle: (standard: FollowableStandardId) => void;
}

/** One standard in plain words with where the experiment stands, and a switch where it can be followed. */
export function StandardChoiceRow({ readiness, isFollowing, onToggle }: StandardChoiceRowProps) {
  const { t } = useTranslation("standards");
  const { standard, status } = readiness;

  const detail = t(`status.${status.code}`, { ...status });
  const name = t(`standard.${standard}.title`);

  const handleChange = () => {
    if (isFollowable(standard)) {
      onToggle(standard);
    }
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex-1">
        <StandardName standard={standard} detail={detail} />
      </div>

      {canFollow(readiness) ? (
        <Switch checked={isFollowing} onCheckedChange={handleChange} aria-label={name} />
      ) : null}
    </li>
  );
}
