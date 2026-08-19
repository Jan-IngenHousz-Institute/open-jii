"use client";

import { UserAvatar } from "@/components/user-avatar";
import Link from "next/link";

/** One bubble on the trail. `avatarUrl` is absent for anything that has no picture. */
export interface AvatarTrailFace {
  /** Stable across refetches — a user id, a team id. */
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

/** How many faces show before the rest become a count. */
const MAX_VISIBLE_FACES = 5;

/**
 * An overlapping stack of faces linking to the full list, matching the experiment
 * overview's collaborators trail. Generic over the faces so members and teams read as
 * one treatment in the About card.
 *
 * The stack is decorative — `label` says the same thing in words beside it, so a
 * screen reader gets that rather than a row of unlabelled images.
 */
export function OrganizationAvatarTrail({
  faces,
  label,
  href,
  isPending = false,
}: {
  faces: AvatarTrailFace[];
  /** The count in words — the trail's accessible name, and its visible caption. */
  label: string;
  href: string;
  isPending?: boolean;
}) {
  const visible = faces.slice(0, MAX_VISIBLE_FACES);
  const remainder = faces.length - visible.length;

  return (
    <Link
      href={href}
      className="hover:bg-muted/50 group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 transition-colors"
    >
      {isPending ? (
        <div className="flex -space-x-2" aria-hidden>
          {[0, 1, 2].map((bubble) => (
            <div
              key={bubble}
              className="ring-background bg-muted h-6 w-6 animate-pulse rounded-full ring-2"
            />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="flex -space-x-2" aria-hidden>
          {visible.map((face) => (
            <UserAvatar
              key={face.id}
              avatarUrl={face.avatarUrl}
              firstName={face.firstName}
              lastName={face.lastName}
              className="ring-background bg-muted h-6 w-6 text-[10px] ring-2"
            />
          ))}
          {remainder > 0 ? (
            <div className="ring-background bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2">
              +{remainder}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* `text-sm` to match the other values in the About card's list. */}
      <span className="text-muted-foreground group-hover:text-foreground text-sm transition-colors">
        {label}
      </span>
    </Link>
  );
}

/** A team as a trail face: split on the first space so a two-word team gets two initials. */
export function teamAsTrailFace(team: { id: string; name: string }): AvatarTrailFace {
  const [firstWord = "", ...rest] = team.name.trim().split(/\s+/u);
  return { id: team.id, firstName: firstWord, lastName: rest.join(" ") };
}
