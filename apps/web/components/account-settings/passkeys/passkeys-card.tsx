"use client";

import { Fingerprint } from "lucide-react";
import { usePasskeys } from "~/hooks/auth/usePasskeys/usePasskeys";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { AddPasskeyDialog } from "./add-passkey-dialog";
import { DeletePasskeyDialog } from "./delete-passkey-dialog";
import { RenamePasskeyDialog } from "./rename-passkey-dialog";

export function PasskeysCard() {
  const { t } = useTranslation("account");
  const locale = useLocale();
  const { data: passkeys, isLoading } = usePasskeys();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{t("passkeys.title")}</CardTitle>
          <CardDescription>{t("passkeys.description")}</CardDescription>
        </div>
        <AddPasskeyDialog />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" data-testid="passkeys-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !passkeys || passkeys.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-sm">
            <Fingerprint className="h-8 w-8 opacity-50" />
            {t("passkeys.empty")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("passkeys.columns.name")}</TableHead>
                <TableHead>{t("passkeys.columns.type")}</TableHead>
                <TableHead>{t("passkeys.columns.created")}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {passkeys.map((passkey) => (
                <TableRow key={passkey.id}>
                  <TableCell className="font-medium">
                    {passkey.name ?? t("passkeys.unnamed")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {passkey.backedUp ? t("passkeys.synced") : t("passkeys.deviceBound")}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(passkey.createdAt).toLocaleDateString(locale)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <RenamePasskeyDialog
                        passkeyId={passkey.id}
                        currentName={passkey.name ?? ""}
                      />
                      <DeletePasskeyDialog
                        passkeyId={passkey.id}
                        passkeyName={passkey.name ?? t("passkeys.unnamed")}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
