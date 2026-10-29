"use client";

import { Building2, Mail, Search, Users, X } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@repo/ui/components/popover";
import { cn } from "@repo/ui/lib/utils";

import { NameLine, PersonIdentity } from "../person-identity";
import type { EmailInviteReason, PickerRow } from "./picking-rule";
import type { SearchStatus } from "./use-people-search";

interface PeoplePickerProps<V> {
  term: string;
  onTermChange: (term: string) => void;
  /** What the box shows once something is picked; the box is read-only while set. */
  selectionLabel: string | null;
  onClear: () => void;
  placeholder: string;
  ariaLabel: string;
  clearLabel?: string;
  disabled?: boolean;
  /** Teams and organizations list on focus; people wait for 2 characters. */
  browsable?: boolean;
  status: SearchStatus;
  rows: PickerRow<V>[];
  onPick: (value: V) => void;
  emptyMessage: string;
  /** An `emailInviteFor` answer for the typed term, and what to say when it is no. */
  emailInvite?: {
    offer: boolean;
    reason: EmailInviteReason;
    label: string;
    onPick: (email: string) => void;
    messages: { invited?: string; member?: string };
  };
  /** Sits before the search box, inside the row the list anchors to. */
  leading?: ReactNode;
  className?: string;
}

export function PeoplePicker<V>({
  term,
  onTermChange,
  selectionLabel,
  onClear,
  placeholder,
  ariaLabel,
  clearLabel,
  disabled = false,
  browsable = false,
  status,
  rows,
  onPick,
  emptyMessage,
  emailInvite,
  leading,
  className,
}: PeoplePickerProps<V>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const hasSelection = selectionLabel !== null;
  const email = term.trim();

  const close = () => {
    onTermChange("");
    setOpen(false);
  };

  const inviteRow = emailInvite?.offer && (
    <Button
      type="button"
      variant="ghost"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        emailInvite.onPick(email);
        close();
      }}
      className="hover:bg-muted flex h-auto w-full items-start gap-3 whitespace-normal px-3 py-2.5 text-left"
    >
      <IconCircle icon={Mail} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{email}</div>
        <div className="text-muted-foreground text-xs">{emailInvite.label}</div>
      </div>
    </Button>
  );
  const note =
    emailInvite?.reason === "invited"
      ? emailInvite.messages.invited
      : emailInvite?.reason === "member"
        ? emailInvite.messages.member
        : undefined;

  const list = () => {
    if (!browsable && email.length < 2) {
      return <ListMessage>{t("common.searchMinCharacters")}</ListMessage>;
    }
    if (status.isLoading) return <ListMessage>{t("common.loading")}</ListMessage>;
    // A failed search has no rows either, and "nothing found" would be a claim nobody made.
    if (status.isError) {
      return (
        <div className="flex flex-col items-center gap-2 p-4 text-center">
          <p className="text-destructive break-words text-sm">{t("common.searchFailed")}</p>
          <Button
            type="button"
            variant="outline"
            onMouseDown={(e) => e.preventDefault()}
            onClick={status.onRetry}
          >
            {t("errors.tryAgain")}
          </Button>
        </div>
      );
    }
    if (rows.length === 0) {
      // No row left for a registered address means it is the viewer's own.
      const emptyNote = emailInvite?.reason === "registered" ? emailInvite.messages.member : note;
      return inviteRow ? (
        <div className="py-1">{inviteRow}</div>
      ) : (
        <ListMessage>{emptyNote ?? emptyMessage}</ListMessage>
      );
    }
    return (
      <div className="py-2">
        {rows.map((row) => (
          <Button
            key={row.key}
            type="button"
            variant="ghost"
            disabled={row.unavailableReason !== null}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(row.value);
              close();
            }}
            // The Button base is nowrap, and a row's badges and reasons have to wrap.
            className="hover:bg-muted flex h-auto w-full items-start gap-3 whitespace-normal px-3 py-2.5 text-left disabled:opacity-60"
          >
            <RowBody row={row} />
          </Button>
        ))}
        {inviteRow ? (
          <div className="border-border border-t">{inviteRow}</div>
        ) : note ? (
          <p className="border-border text-muted-foreground border-t px-3 py-2.5 text-xs">{note}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
          {leading}
          <div ref={searchRef} className="relative min-w-0 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              value={selectionLabel ?? term}
              readOnly={hasSelection}
              disabled={disabled}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="pl-9 pr-9"
              onFocus={() => {
                if (!hasSelection && browsable) setOpen(true);
              }}
              onChange={(e) => {
                if (hasSelection) return;
                onTermChange(e.target.value);
                setOpen(browsable || e.target.value.length > 0);
              }}
            />
            {(hasSelection || term.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onClear();
                  close();
                }}
                disabled={disabled}
                aria-label={clearLabel ?? t("common.clear")}
                className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="max-h-[300px] w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw_-_2rem))] max-w-[calc(100vw_-_2rem)] overflow-y-auto p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // The opening focus reaches the outside listener, and an anchor has no trigger exemption.
        onInteractOutside={(event) => {
          if (searchRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        {list()}
      </PopoverContent>
    </Popover>
  );
}

function RowBody<V>({ row }: { row: PickerRow<V> }) {
  const badges =
    row.badges.length > 0 &&
    row.badges.map((badge) => (
      <Badge key={badge} variant="outline" className="text-xs font-normal">
        {badge}
      </Badge>
    ));
  const reason = row.unavailableReason && (
    <div className="text-muted-foreground text-xs">{row.unavailableReason}</div>
  );

  if (row.person) {
    return (
      <PersonIdentity person={row.person} identityLine={row.identityLine} badges={badges}>
        {reason}
      </PersonIdentity>
    );
  }

  return (
    <>
      <IconCircle icon={row.kind === "team" ? Users : Building2} />
      <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
        <NameLine badges={badges}>
          <span className="min-w-0 break-words text-sm font-medium">{row.label}</span>
        </NameLine>
        {row.identityLine && (
          <div className="text-muted-foreground text-xs">{row.identityLine}</div>
        )}
        {reason}
      </div>
    </>
  );
}

function IconCircle({ icon: Icon }: { icon: typeof Mail }) {
  return (
    <div className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
      <Icon className="text-muted-foreground h-4 w-4" />
    </div>
  );
}

function ListMessage({ children }: { children: ReactNode }) {
  return (
    <div className="text-muted-foreground break-words p-4 text-center text-sm">{children}</div>
  );
}
