import { namespaces } from "@repo/i18n";
import initTranslations from "@repo/i18n/server";

import { SiteHeader } from "./site-header";
import { headerLabelKey, headerLabels } from "./site-header-labels";

export async function SiteHeaderWrapper({ locale }: { locale: string }) {
  const labels = headerLabels(locale);
  const used = new Set(labels.map((label) => label.namespace ?? "common"));

  const { t } = await initTranslations({
    locale,
    namespaces: namespaces.filter((namespace) => used.has(namespace)),
  });

  const translated = Object.fromEntries(
    labels.map((label) => [
      headerLabelKey(label.key, label.namespace),
      t(label.key, { ns: label.namespace }),
    ]),
  );

  return <SiteHeader locale={locale} labels={translated} />;
}
