"use client";

import { Check, ChevronDown, ChevronUp, Mail, UserRoundPlus, X } from "lucide-react";
import { useState } from "react";

import type { ExperimentJoinRequest } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { toast } from "@repo/ui/hooks/use-toast";

import { useApproveJoinRequest } from "../../hooks/experiment/join-request/useApproveJoinRequest/useApproveJoinRequest";
import { useExperimentJoinRequests } from "../../hooks/experiment/join-request/useExperimentJoinRequests/useExperimentJoinRequests";
import { useRejectJoinRequest } from "../../hooks/experiment/join-request/useRejectJoinRequest/useRejectJoinRequest";
import { parseApiError } from "../../util/apiError";

interface ExperimentJoinRequestsPanelProps {
  experimentId: string;
  joinRequests?: ExperimentJoinRequest[];
}

function JoinRequestRow({
  request,
  onApprove,
  onReject,
  isApprovingJoinRequest,
  isRejectingJoinRequest,
  isPending,
}: {
  request: ExperimentJoinRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isApprovingJoinRequest: boolean;
  isRejectingJoinRequest: boolean;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [isMessageOpen, setIsMessageOpen] = useState(false);

  const displayName = `${request.user.firstName} ${request.user.lastName}`;
  const rejectLabel = t("experimentSettings.rejectJoinRequest");
  const approveLabel = t("experimentSettings.approveJoinRequest");

  return (
    <div className="border-border rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground truncate text-sm font-medium" title={displayName}>
            {displayName}
          </span>
          {request.user.email && (
            <span className="flex min-w-0 items-center gap-x-1">
              <Mail className="text-muted-foreground h-3 w-3 flex-shrink-0" />
              <span className="text-muted-foreground truncate text-sm" title={request.user.email}>
                {request.user.email}
              </span>
            </span>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex shrink-0 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 [&_svg]:size-4"
                  onClick={() => onReject(request.id)}
                  disabled={isRejectingJoinRequest || isApprovingJoinRequest || isPending}
                  aria-label={rejectLabel}
                >
                  <X aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{rejectLabel}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 [&_svg]:size-4"
                  onClick={() => onApprove(request.id)}
                  disabled={isApprovingJoinRequest || isRejectingJoinRequest || isPending}
                  aria-label={approveLabel}
                >
                  <Check aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{approveLabel}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <Collapsible open={isMessageOpen} onOpenChange={setIsMessageOpen}>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs transition-colors">
          {isMessageOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {t("experimentSettings.joinRequestMessageLabel")}
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden [--radix-accordion-content-height:var(--radix-collapsible-content-height)]">
          <div className="mt-2 w-full">
            {request.message ? (
              <p className="text-muted-foreground whitespace-pre-line text-sm">{request.message}</p>
            ) : (
              <p className="text-muted-foreground text-xs italic">
                {t("experimentSettings.joinRequestNoMessage")}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ExperimentJoinRequestsPanel({
  experimentId,
  joinRequests: providedJoinRequests,
}: ExperimentJoinRequestsPanelProps) {
  const { t } = useTranslation();
  const { data: joinRequestsData } = useExperimentJoinRequests(experimentId);
  const joinRequests: ExperimentJoinRequest[] =
    providedJoinRequests ?? (joinRequestsData?.status === 200 ? joinRequestsData.body : []);

  const { mutateAsync: approveJoinRequest, isPending: isApprovingJoinRequest } =
    useApproveJoinRequest();
  const { mutateAsync: rejectJoinRequest, isPending: isRejectingJoinRequest } =
    useRejectJoinRequest();
  const [pendingJoinRequestId, setPendingJoinRequestId] = useState<string | null>(null);

  const handleApprove = async (requestId: string) => {
    setPendingJoinRequestId(requestId);
    try {
      await approveJoinRequest(
        { params: { id: experimentId, requestId }, body: {} },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.joinRequestApproved") });
          },
          onError: (err) => {
            toast({
              description:
                parseApiError(err)?.message ?? t("experimentSettings.joinRequestApprovedError"),
              variant: "destructive",
            });
          },
        },
      );
    } finally {
      setPendingJoinRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setPendingJoinRequestId(requestId);
    try {
      await rejectJoinRequest(
        { params: { id: experimentId, requestId }, body: {} },
        {
          onSuccess: () => {
            toast({ description: t("experimentSettings.joinRequestRejected") });
          },
          onError: (err) => {
            toast({
              description:
                parseApiError(err)?.message ?? t("experimentSettings.joinRequestRejectedError"),
              variant: "destructive",
            });
          },
        },
      );
    } finally {
      setPendingJoinRequestId(null);
    }
  };

  if (joinRequests.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-muted-foreground bg-muted mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full">
          <UserRoundPlus className="h-5 w-5" />
        </div>
        <p className="text-foreground text-sm font-semibold">
          {t("experimentSettings.noJoinRequests")}
        </p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-[280px] text-xs leading-relaxed">
          {t("experimentSettings.noJoinRequestsHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-h-[200px] space-y-3 overflow-y-auto">
      {joinRequests.map((request) => (
        <JoinRequestRow
          key={request.id}
          request={request}
          onApprove={handleApprove}
          onReject={handleReject}
          isApprovingJoinRequest={isApprovingJoinRequest}
          isRejectingJoinRequest={isRejectingJoinRequest}
          isPending={pendingJoinRequestId === request.id}
        />
      ))}
    </div>
  );
}
