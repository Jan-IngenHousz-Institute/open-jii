"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ExperimentCreateJoinRequestBody } from "@repo/api/domains/experiment/join-requests/experiment-join-requests.schema";
import { zExperimentCreateJoinRequestBody } from "@repo/api/domains/experiment/join-requests/experiment-join-requests.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@repo/ui/components/form";
import { Textarea } from "@repo/ui/components/textarea";

import { useCancelMyJoinRequest } from "../../../hooks/experiment/join-request/useCancelMyJoinRequest/useCancelMyJoinRequest";
import { useMyJoinRequest } from "../../../hooks/experiment/join-request/useMyJoinRequest/useMyJoinRequest";
import { useRequestJoinExperiment } from "../../../hooks/experiment/join-request/useRequestJoinExperiment/useRequestJoinExperiment";

interface ExperimentRequestToJoinProps {
  experimentId: string;
}

export function ExperimentRequestToJoin({ experimentId }: ExperimentRequestToJoinProps) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const form = useForm<ExperimentCreateJoinRequestBody>({
    resolver: zodResolver(zExperimentCreateJoinRequestBody),
    defaultValues: {
      message: "",
    },
  });

  const { data: myRequestData, isLoading: isLoadingMyRequest } = useMyJoinRequest(experimentId);
  const { mutate: requestJoin, isPending: isRequesting } = useRequestJoinExperiment({
    onSuccess: () => {
      setIsDialogOpen(false);
      form.reset();
    },
  });
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelMyJoinRequest();

  if (isLoadingMyRequest) {
    return null;
  }

  const pendingRequest = myRequestData ?? null;

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);

    if (!open) {
      form.reset();
    }
  };

  const handleSubmit = (data: ExperimentCreateJoinRequestBody) => {
    const trimmedMessage = data.message?.trim();
    const message = trimmedMessage === "" ? undefined : trimmedMessage;
    requestJoin({ id: experimentId, message: message ?? undefined });
  };

  const handleCancel = () => {
    if (!pendingRequest) return;
    cancelRequest({ id: experimentId, requestId: pendingRequest.id });
  };

  if (pendingRequest) {
    return (
      <div className="text-muted-foreground text-sm leading-relaxed">
        <span>{t("experimentSettings.requestPendingDescription")}</span>{" "}
        <span>{t("experimentSettings.cancelRequestPrompt")}</span>{" "}
        <Button
          variant="buttonLink"
          className="h-auto p-0 align-baseline text-sm font-medium"
          onClick={handleCancel}
          isLoading={isCancelling}
        >
          {t("experimentSettings.cancelRequest")}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
      <div className="text-muted-foreground text-sm leading-relaxed">
        <span>{t("experimentSettings.requestToJoinPrompt")}</span>{" "}
        <DialogTrigger asChild>
          <Button variant="buttonLink" className="h-auto p-0 align-baseline text-sm font-medium">
            {t("experimentSettings.requestToJoin")}
          </Button>
        </DialogTrigger>{" "}
        <span>{t("experimentSettings.requestToJoinPromptSuffix")}</span>
      </div>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{t("experimentSettings.requestToJoinTitle")}</DialogTitle>
              <DialogDescription>
                {t("experimentSettings.requestToJoinDescription")}
              </DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="message"
              disabled={isRequesting}
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      placeholder={t("experimentSettings.requestToJoinPlaceholder")}
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="mt-4">
              <Button variant="outline" type="button" onClick={() => handleDialogOpenChange(false)}>
                {t("experimentSettings.cancel")}
              </Button>
              <Button variant="default" type="submit" disabled={isRequesting}>
                {isRequesting
                  ? t("experimentSettings.requestToJoinSubmitting")
                  : t("experimentSettings.requestToJoinSubmit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
