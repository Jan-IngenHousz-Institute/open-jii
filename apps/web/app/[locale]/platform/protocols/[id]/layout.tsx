"use client";

import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(undefined, "common");
  const locale = useLocale();
  const { data: session } = useSession();
  const { data: protocolData } = useProtocol(id);

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith(`/protocols/${id}`)) return "overview";
    return "overview";
  };

  const activeTab = getActiveTab();

  // Check if current user is the creator of the protocol
  const userId = session?.user.id;
  const createdBy = protocolData?.body.createdBy;
  const isCreator = userId && createdBy && createdBy === userId;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("protocols.protocol")}</h3>
        <p className="text-muted-foreground text-sm">{t("protocols.manageProtocolDescription")}</p>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className={`grid w-full ${isCreator ? "grid-cols-2" : "grid-cols-1"}`}>
          <TabsTrigger value="overview" asChild>
            <Link href={`/platform/protocols/${id}`} locale={locale}>
              {t("protocols.overview")}
            </Link>
          </TabsTrigger>
          {isCreator && (
            <TabsTrigger value="settings" asChild>
              <Link href={`/platform/protocols/${id}/settings`} locale={locale}>
                {t("navigation.settings")}
              </Link>
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mx-4 mt-6">{children}</div>
      </Tabs>
    </div>
  );
}
