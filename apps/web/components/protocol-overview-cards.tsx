import { ArrowRight, Calendar, User, Webcam } from "lucide-react";
import Link from "next/link";
import { formatDate } from "~/util/date";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent, CardHeader } from "@repo/ui/components";

export function ProtocolOverviewCards({ protocols }: { protocols: Protocol[] | undefined }) {
  const { t } = useTranslation("common");

  if (!protocols) {
    return <span>{t("protocols.loadingProtocols")}</span>;
  }

  if (protocols.length === 0) {
    return <span>{t("protocols.noProtocols")}</span>;
  }

  return (
    <>
      {/* Protocols Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {protocols.map((protocol) => {
          return (
            <Link key={protocol.id} href={`/platform/protocols/${protocol.id}`}>
              <Card className="bg-white transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="mb-2 max-w-72 overflow-hidden truncate whitespace-nowrap font-semibold text-gray-900">
                        {protocol.name}
                      </h3>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Webcam className="h-4 w-4" />
                      <span>{protocol.family}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{protocol.createdByName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(protocol.updatedAt)}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    className="mt-6 h-auto w-full justify-between p-0 font-normal text-gray-700 hover:text-gray-900"
                  >
                    {t("protocols.viewDetails")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
