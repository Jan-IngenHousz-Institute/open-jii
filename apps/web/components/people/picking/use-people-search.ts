import { useGranteeUserSearch } from "@/hooks/sharing/useGranteeUserSearch/useGranteeUserSearch";
import { useDebounce } from "@/hooks/useDebounce";
import { useUserSearch } from "@/hooks/useUserSearch";
import { useState } from "react";

import type { GranteeUserDto, SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import type { UserSearchResult } from "@repo/api/domains/user/user.schema";

import { isEmailAddress } from "./picking-rule";

interface ShareSource {
  kind: "share";
  resourceType: SharingResourceType;
  resourceId: string;
}

export interface SearchStatus {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export interface PeopleSearch<P> {
  term: string;
  setTerm: (term: string) => void;
  debouncedTerm: string;
  /** The answer on screen is for exactly what is typed now. */
  isSettled: boolean;
  /** The term when it is a complete address the answer on screen is for. */
  typedEmail: string | null;
  people: P[];
  status: SearchStatus;
}

/** The term, its debounce, and the people search behind it; nothing is asked below 2 characters. */
export function usePeopleSearch(
  source: { kind: "global" },
  options?: { enabled?: boolean },
): PeopleSearch<UserSearchResult>;
export function usePeopleSearch(
  source: ShareSource,
  options?: { enabled?: boolean },
): PeopleSearch<GranteeUserDto>;
export function usePeopleSearch(
  source: { kind: "global" } | ShareSource,
  { enabled = true }: { enabled?: boolean } = {},
): PeopleSearch<UserSearchResult | GranteeUserDto> {
  const [term, setTerm] = useState("");
  const [debouncedTerm, isDebounced] = useDebounce(term);

  const isShare = source.kind === "share";
  const global = useUserSearch(!isShare && enabled ? debouncedTerm : "");
  const share = useGranteeUserSearch(
    isShare ? source.resourceType : "experiment",
    isShare ? source.resourceId : "",
    debouncedTerm,
    { enabled: isShare && enabled },
  );
  const query = isShare ? share : global;

  const isSettled = isDebounced && debouncedTerm.trim().toLowerCase() === term.trim().toLowerCase();

  return {
    term,
    setTerm,
    debouncedTerm,
    isSettled,
    typedEmail: isSettled && isEmailAddress(term) ? term.trim() : null,
    people: (enabled ? query.data : undefined) ?? [],
    status: {
      isLoading: enabled && (query.isFetching || (!isDebounced && term.length > 0)),
      isError: enabled && query.isError,
      onRetry: () => void query.refetch(),
    },
  };
}
