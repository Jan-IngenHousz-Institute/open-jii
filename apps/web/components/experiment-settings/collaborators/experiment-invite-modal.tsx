"use client";

import { useEffect, useMemo, useState } from "react";

import type { ExperimentMemberRole } from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentMember } from "@repo/api/domains/experiment/members/experiment-members.schema";
import type { Invitation, UserProfile } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { toast } from "@repo/ui/hooks/use-toast";

import { useExperimentMemberAdd } from "../../../hooks/experiment/useExperimentMemberAdd/useExperimentMemberAdd";
import { useDebounce } from "../../../hooks/useDebounce";
import { useUserSearch } from "../../../hooks/useUserSearch";
import { useUserInvitationCreate } from "../../../hooks/user-invitation/useUserInvitationCreate/useUserInvitationCreate";
import { UserSearchPopover } from "../../user-search-popover";

type MemberSelection =
  | { type: "user"; user: UserProfile }
  | { type: "email"; email: string }
  | null;

interface ExperimentInviteModalProps {
  experimentId: string;
  members: ExperimentMember[];
  invitations: Invitation[];
  isArchived: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIsAddingMemberChange?: (isAdding: boolean) => void;
}

export function ExperimentInviteModal({
  experimentId,
  members,
  invitations,
  isArchived,
  open,
  onOpenChange,
  onIsAddingMemberChange,
}: ExperimentInviteModalProps) {
  const { t } = useTranslation();

  const [userSearch, setUserSearch] = useState("");
  const [selection, setSelection] = useState<MemberSelection>(null);
  const [selectedRole, setSelectedRole] = useState<ExperimentMemberRole>("member");
  const [debouncedSearch, isDebounced] = useDebounce(userSearch, 300);
  const { data: userSearchData, isLoading: isFetchingUsers } = useUserSearch(debouncedSearch);

  const { mutateAsync: addMember, isPending: isAddingMember } = useExperimentMemberAdd();
  const { mutateAsync: createInvitation, isPending: isCreatingInvitation } =
    useUserInvitationCreate();

  useEffect(() => {
    onIsAddingMemberChange?.(isAddingMember);
  }, [isAddingMember, onIsAddingMemberChange]);

  const selectedUser = selection?.type === "user" ? selection.user : null;
  const selectedEmail = selection?.type === "email" ? selection.email : null;

  const isSubmitDisabled = !selection || isAddingMember || isCreatingInvitation || isArchived;

  const availableUsers = useMemo(() => {
    if (userSearchData && Array.isArray(userSearchData)) {
      return userSearchData.filter((user) => !members.some((m) => m.user.id === user.userId));
    }
    return [];
  }, [userSearchData, members]);

  const resetSelection = () => {
    setUserSearch("");
    setSelection(null);
    setSelectedRole("member");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetSelection();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!selection) return;

    if (selection.type === "user") {
      await addMember(
        {
          id: experimentId,
          members: [{ userId: selection.user.userId, role: selectedRole }],
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.memberAdded") });
            resetSelection();
            onOpenChange(false);
          },
        },
      );
    } else {
      await createInvitation(
        {
          resourceType: "experiment",
          resourceId: experimentId,
          email: selection.email,
          role: selectedRole,
        },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.invitationSent") });
            resetSelection();
            onOpenChange(false);
          },
        },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("experimentSettings.inviteCollaborators")}</DialogTitle>
          <DialogDescription>
            {t("experimentSettings.inviteCollaboratorsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <UserSearchPopover
            availableUsers={availableUsers}
            searchValue={userSearch}
            onSearchChange={setUserSearch}
            isAddingUser={isAddingMember || isCreatingInvitation}
            loading={!isDebounced || isFetchingUsers}
            onSelectUser={(user) => setSelection({ type: "user", user })}
            onSelectEmail={(email) => setSelection({ type: "email", email })}
            placeholder={t("experiments.searchUsersPlaceholder")}
            selectedUser={selectedUser}
            selectedEmail={selectedEmail}
            onClearSelection={() => setSelection(null)}
            disabled={isArchived}
            selectedRole={selectedRole}
            onRoleChange={(val) => setSelectedRole(val as ExperimentMemberRole)}
            existingEmails={[
              ...members.map((m) => m.user.email).filter((e): e is string => e != null),
              ...invitations.map((inv) => inv.email),
            ]}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            {t("experimentSettings.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
