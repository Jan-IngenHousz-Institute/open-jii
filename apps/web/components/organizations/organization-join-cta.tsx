"use client";

import { useCancelMyOrganizationJoinRequest } from "@/hooks/organization/join-request/useCancelMyOrganizationJoinRequest/useCancelMyOrganizationJoinRequest";
import { useRequestJoinOrganization } from "@/hooks/organization/join-request/useRequestJoinOrganization/useRequestJoinOrganization";
import { Clock, UserPlus } from "lucide-react";
import { useState } from "react";
import { parseApiError } from "~/util/apiError";

import { zCreateOrganizationJoinRequestBody } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";
import type { OrganizationMembershipStatus } from "@repo/api/domains/organization/organization.schema";
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
import { Textarea } from "@repo/ui/components/textarea";
import { toast } from "@repo/ui/hooks/use-toast";

/** The contract's own cap, so the counter and the server agree on the limit. */
const MESSAGE_MAX_LENGTH =
  zCreateOrganizationJoinRequestBody.shape.message.unwrap().maxLength ?? 250;

interface OrganizationJoinCtaProps {
  organizationId: string;
  organizationName: string;
  membershipStatus: OrganizationMembershipStatus;
  size?: "sm" | "default";
}

/**
 * Ask to join, or withdraw the ask. Three states, driven entirely by the
 * `membershipStatus` every organization read carries — there is no local
 * optimistic state, because the whole point of the pending state is that it
 * reflects what the server has.
 *
 * Members get nothing here: their way in is the management surface, which the
 * caller renders instead.
 */
export function OrganizationJoinCta({
  organizationId,
  organizationName,
  membershipStatus,
  size = "default",
}: OrganizationJoinCtaProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [message, setMessage] = useState("");

  const { mutateAsync: requestJoin, isPending: isRequesting } = useRequestJoinOrganization();
  const { mutateAsync: cancelRequest, isPending: isCancelling } =
    useCancelMyOrganizationJoinRequest();

  if (membershipStatus === "member") return null;

  const submitRequest = async () => {
    try {
      await requestJoin({
        id: organizationId,
        // An untouched box is no message at all, not an empty one.
        message: message.trim() === "" ? undefined : message.trim(),
      });
      toast({ description: t("organizations.join.requested", { name: organizationName }) });
      setIsDialogOpen(false);
      setMessage("");
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("organizations.join.requestFailed"),
        variant: "destructive",
      });
    }
  };

  const withdrawRequest = async () => {
    try {
      await cancelRequest({ id: organizationId });
      toast({ description: t("organizations.join.cancelled") });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? t("organizations.join.cancelFailed"),
        variant: "destructive",
      });
    }
  };

  if (membershipStatus === "pending_request") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5" />
          {t("organizations.join.pending")}
        </span>
        <Button
          variant="outline"
          size={size}
          onClick={() => void withdrawRequest()}
          disabled={isCancelling}
        >
          {t("organizations.join.cancelAction")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button size={size} className="shrink-0" onClick={() => setIsDialogOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {t("organizations.join.requestAction")}
      </Button>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(next) => {
          // A submission in flight must not be dismissed out from under itself.
          if (!next && isRequesting) return;
          setIsDialogOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!isRequesting}>
          <DialogHeader>
            <DialogTitle>{t("organizations.join.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("organizations.join.dialogDescription", { name: organizationName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Textarea
              value={message}
              maxLength={MESSAGE_MAX_LENGTH}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("organizations.join.messagePlaceholder")}
              aria-label={t("organizations.join.messageLabel")}
              disabled={isRequesting}
            />
            <p className="text-muted-foreground text-xs">
              {t("organizations.join.messageHint", { max: MESSAGE_MAX_LENGTH })}
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isRequesting}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void submitRequest()} disabled={isRequesting}>
              {isRequesting ? t("organizations.join.requesting") : t("organizations.join.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
