"use client";

import { ErrorDisplay } from "@/components/error-display";
import { useProtocol } from "@/hooks/protocol/useProtocol/useProtocol";
import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";
import { notFound, usePathname, useParams } from "next/navigation";

import { useSession } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components";

interface ProtocolLayoutProps {
  children: React.ReactNode;
}

export default function ProtocolLayout({ children }: ProtocolLayoutProps) {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const locale = useLocale();
  const { data: session } = useSession();
  const { data: protocolData, isLoading, error } = useProtocol(id);

  // Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">{t("protocols.loadingProtocols")}</div>
      </div>
    );
  }

  // Error handling
  if (error) {
    const errorObj = error as { status?: number };
    const errorStatus = errorObj.status;

    // Handle 404 Not Found or 400 Bad Request (e.g., invalid UUID) - show not found page
    if (errorStatus === 404 || errorStatus === 400) {
      notFound();
    }

    // Show generic error for other types
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{tCommon("errors.error")}</h3>
          <p className="text-muted-foreground text-sm">{t("protocols.notFoundDescription")}</p>
        </div>
        <ErrorDisplay error={error} />
      </div>
    );
  }

  // Determine active tab from URL
  const getActiveTab = () => {
    if (pathname.endsWith("/settings")) return "settings";
    if (pathname.endsWith("/test")) return "test";
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
        <TabsList className={`grid w-full ${isCreator ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="overview" asChild>
            <Link href={`/platform/protocols/${id}`} locale={locale}>
              {t("protocols.overview")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="test" asChild>
            <Link href={`/platform/protocols/${id}/test`} locale={locale}>
              Test
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
