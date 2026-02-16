import { Calendar, ChevronRight, User, Webcam } from "lucide-react";
import Link from "next/link";
import { formatDate } from "~/util/date";

import type { Protocol } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Badge, Skeleton } from "@repo/ui/components";
import { cva } from "@repo/ui/lib/utils";

const cardVariants = cva(
  "relative flex h-full min-h-[180px] flex-col gap-3 rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg",
  {
    variants: {
      featured: {
        true: "border-secondary/30 from-badge-featured bg-gradient-to-br to-white shadow-sm",
        false: "border-gray-200 bg-white",
      },
    },
    defaultVariants: {
      featured: false,
    },
  },
);

export function ProtocolOverviewCards({ protocols }: { protocols: Protocol[] | undefined }) {
  const { t } = useTranslation("common");

  if (!protocols) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  }

  if (protocols.length === 0) {
    return <span>{t("protocols.noProtocols")}</span>;
  }

  return (
    <>
      {/* Protocols Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {protocols.map((protocol) => {
          const isPreferred = protocol.sortOrder !== null;
          return (
            <Link key={protocol.id} href={`/platform/protocols/${protocol.id}`}>
              <div className={cardVariants({ featured: isPreferred })}>
                <div className="mb-auto">
                  <div className="mb-2 flex items-start gap-2">
                    <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-base font-semibold text-gray-900 md:text-lg">
                      {protocol.name}
                    </h3>
                    {isPreferred && (
                      <div className="shrink-0">
                        <Badge className={"bg-secondary/30 text-primary"}>
                          {t("common.preferred")}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Webcam className="h-4 w-4" />
                      <span>{protocol.family}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{protocol.createdByName ?? "-"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Updated {formatDate(protocol.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="absolute bottom-5 right-5 h-6 w-6 text-gray-900 md:hidden" />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
