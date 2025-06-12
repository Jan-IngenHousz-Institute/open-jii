import Link from "next/link";

import type { Locale } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

const items = [1, 2, 3, 4];

interface DataExamplePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DataExamplePage({
  params,
}: DataExamplePageProps) {
  const { locale } = await params;
  const { t } = await initTranslations({
    locale,
    namespaces: ["common"],
  });

  return (
    <div>
      <h1>Data Example Page</h1>
      <ul className="mt-4 list-disc">
        {items.map((item, index) => {
          return (
            <li key={index}>
              <Link href={`/platform/data-test/${item}`} locale={locale}>
                {t("data-test")} {item}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
