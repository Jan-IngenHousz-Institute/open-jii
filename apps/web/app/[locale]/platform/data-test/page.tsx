import Link from "next/link";

import type { Locale } from "@repo/i18n";

const items = ["06464d1c-a0da-45e6-9532-ca3a4a3fd69b"];

interface DataExamplePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function DataExamplePage({ params }: DataExamplePageProps) {
  const { locale } = await params;

  return (
    <div>
      <h1>Data Example Page</h1>
      <ul className="mt-4 list-disc">
        {items.map((item, index) => {
          return (
            <li className="ml-4" key={index}>
              <Link href={`/platform/data-test/${item}`} locale={locale}>
                {item}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
